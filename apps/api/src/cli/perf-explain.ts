/**
 * `pnpm --filter @how-about-me/api perf:explain -- [--runs 15] [--warmup 3] [--only <substring>] [--out <md>]
 *   [--json <path>] [--prepared-cache] [--allow-any-db] [--database-url <url>]`
 *
 * T-097 (#84): runs every analytics / mentions / export read path against the perf database (perf:seed), reports
 * single-client p50/p95 wall time per scenario plus `EXPLAIN (ANALYZE, BUFFERS)` of each SQL statement it sent.
 * Same guard as perf:seed. Report format: docs/02-architecture/12-performance-report.md.
 */
import { writeFileSync } from "node:fs";
import { type Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { PrismaService } from "../database/prisma.service";
import { assertPerfDatabase } from "./perf-seed/guard";
import { type ExplainJson, percentile, summarizePlan } from "./perf-seed/plan-summary";
import { buildScenarios, type ScenarioCtx } from "./perf-seed/scenarios";

const argsSchema = z.object({
  runs: z.coerce.number().int().min(1).max(200).default(15),
  warmup: z.coerce.number().int().min(0).max(50).default(3),
  only: z.string().optional(),
  out: z.string().optional(),
  json: z.string().optional(),
  allowAnyDb: z.boolean().default(false),
  preparedCache: z.boolean().default(false),
  databaseUrl: z.string().optional(),
});

function parseArgs(argv: readonly string[]): z.infer<typeof argsSchema> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--") continue;
    if (!a.startsWith("--")) throw new Error(`unexpected argument "${a}"`);
    const name = a.slice(2).replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
    if (name === "allowAnyDb" || name === "preparedCache") {
      flags[name] = true;
      continue;
    }
    const v = argv[++i];
    if (v === undefined) throw new Error(`${a} requires a value`);
    flags[name] = v;
  }
  return argsSchema.strict().parse(flags);
}

type Recorder = { sink: Prisma.Sql[] };

/** `Prisma.Sql` is not exported as a runtime class; tagged-template calls pass a TemplateStringsArray instead. */
function isSql(q: unknown): q is Prisma.Sql {
  return typeof q === "object" && q !== null && !Array.isArray(q) && "sql" in q && "values" in q;
}

/** Proxy that forwards everything to the real client and records every `$queryRaw(Prisma.Sql)` (incl. inside tx). */
function recording<T extends object>(target: T, rec: Recorder): T {
  return new Proxy(target, {
    get(t, key) {
      const v: unknown = Reflect.get(t, key, t);
      if (typeof v !== "function") return v;
      const fn = v as (...a: unknown[]) => unknown;
      if (key === "$queryRaw") {
        return (q: unknown, ...rest: unknown[]) => {
          if (isSql(q)) rec.sink.push(q);
          return fn.call(t, q, ...rest);
        };
      }
      if (key === "$transaction") {
        return (arg: unknown, opts?: unknown) =>
          typeof arg === "function"
            ? fn.call(t, (tx: object) => (arg as (tx: object) => unknown)(recording(tx, rec)), opts)
            : fn.call(t, arg, opts);
      }
      return fn.bind(t);
    },
  });
}

/**
 * Default mimics production: the Supabase pooler URL carries `pgbouncer=true`, so Prisma never reuses named prepared
 * statements and Postgres plans every execution with the real parameters (custom plan). `--prepared-cache` keeps
 * Prisma's default statement cache (direct connection, e.g. local dev) where Postgres may switch to a generic plan
 * after 5 executions — see docs/02-architecture/12-performance-report.md §4.
 */
function connectionUrl(url: string | undefined, preparedCache: boolean): string | undefined {
  if (!url || preparedCache) return url;
  const u = new URL(url);
  u.searchParams.set("statement_cache_size", "0");
  return u.toString();
}

const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : "–");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const url = args.databaseUrl ?? process.env.PERF_DATABASE_URL;
  const target = assertPerfDatabase(url, { allowAnyDb: args.allowAnyDb });
  const client = new PrismaClient({ datasources: { db: { url: connectionUrl(url, args.preparedCache) } } });
  const db = client as unknown as PrismaService;
  try {
    const project = await client.monitoringProject.findUnique({ where: { slug: "perf-large" }, select: { id: true } });
    if (!project) throw new Error("project perf-large not found — run perf:seed first");
    const [latest, post, actor, pg] = await Promise.all([
      client.socialPost.aggregate({ where: { projectId: project.id }, _max: { publishedAt: true } }),
      client.socialPost.findFirst({ where: { projectId: project.id, overrides: { some: {} } }, select: { id: true } }),
      client.userProfile.findFirst({ orderBy: { email: "asc" }, select: { id: true } }),
      client.$queryRaw<{ v: string }[]>`SELECT current_setting('server_version') AS v`,
    ]);
    if (!post || !actor || !latest._max.publishedAt) throw new Error("perf dataset incomplete");
    const ctx: ScenarioCtx = {
      projectId: project.id,
      postId: post.id,
      actorUserId: actor.id,
      // Ranges end just after the newest post so results do not depend on when the harness runs.
      now: new Date(latest._max.publishedAt.getTime() + 1000),
      exportCap: 10_000,
    };
    const scenarios = buildScenarios(ctx).filter((s) => !args.only || s.name.includes(args.only));
    process.stdout.write(
      `perf:explain → ${target.databaseName} (PostgreSQL ${pg[0]?.v ?? "?"}), ${scenarios.length} scenarios, ` +
        `${args.preparedCache ? "prepared-statement cache ON" : "statement_cache_size=0 (prod pooler)"}\n`,
    );

    const lines = [
      "| Scenario | Target | p50 ms | p95 ms | SQL | Σ exec ms (EXPLAIN) | Seq scans (rows) | Worst estimate (plan → actual) |",
      "|---|---|---:|---:|---:|---:|---|---|",
    ];
    const raw: Record<string, unknown> = {};
    for (const s of scenarios) {
      for (let i = 0; i < args.warmup; i++) await s.run(db);
      const samples: number[] = [];
      for (let i = 0; i < args.runs; i++) {
        const t0 = performance.now();
        await s.run(db);
        samples.push(performance.now() - t0);
      }
      const rec: Recorder = { sink: [] };
      await s.run(recording(db, rec));
      const stmts = rec.sink.filter((q) => !/pg_advisory_xact_lock|set_config/.test(q.text));
      const plans: ExplainJson[] = [];
      for (const q of stmts) {
        // Dev-only exception to "raw SQL via Prisma.sql": q.text is the SQL Prisma itself generated from the
        // repositories' Prisma.sql templates (with $n placeholders); q.values stay bind parameters, never inlined.
        const r = await client.$queryRawUnsafe<{ "QUERY PLAN": ExplainJson[] }[]>(
          `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${q.text}`,
          ...q.values,
        );
        const p = r[0]?.["QUERY PLAN"][0];
        if (p) plans.push(p);
      }
      const sums = plans.map(summarizePlan);
      const seq = new Map<string, number>();
      for (const x of sums)
        for (const sc of x.seqScans) seq.set(sc.relation, Math.max(seq.get(sc.relation) ?? 0, sc.rows));
      const worst = sums
        .map((x) => x.worstMisestimate)
        .filter((w) => w !== null)
        .sort(
          (a, b) =>
            Math.max(b.actualRows, 1) / Math.max(b.planRows, 1) - Math.max(a.actualRows, 1) / Math.max(a.planRows, 1),
        )[0];
      const row = [
        s.name,
        s.nfr,
        fmt(percentile(samples, 50)),
        fmt(percentile(samples, 95)),
        String(stmts.length),
        fmt(sums.reduce((a, x) => a + x.executionMs, 0)),
        [...seq].map(([r, n]) => `${r} (${n})`).join(", ") || "–",
        worst ? `${worst.node}: ${Math.round(worst.planRows)} → ${worst.actualRows}` : "–",
      ];
      lines.push(`| ${row.join(" | ")} |`);
      process.stdout.write(`${lines[lines.length - 1]}\n`);
      raw[s.name] = { samples, plans: stmts.map((q, i) => ({ sql: q.text, plan: plans[i] })) };
    }
    if (args.out) writeFileSync(args.out, `${lines.join("\n")}\n`);
    if (args.json) writeFileSync(args.json, JSON.stringify(raw, null, 1));
  } finally {
    await client.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e: unknown) => {
    process.stderr.write(`perf:explain failed: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
}
