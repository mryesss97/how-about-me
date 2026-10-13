/**
 * `pnpm --filter @how-about-me/api perf:seed -- [--posts 100000] [--seed 84] [--days 120] [--anchor <ISO>]
 *   [--chunk 2000] [--truncate] [--allow-any-db] [--database-url <url>]`
 *
 * T-097 (#84): deterministic synthetic dataset for query-plan / NFR-001..003 measurements —
 * docs/02-architecture/12-performance-report.md. Target = PERF_DATABASE_URL (never DATABASE_URL); refuses a database
 * name without a perf/test marker or a non-local host unless `--allow-any-db`. Prints only the db name and counts.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  buildFixture,
  generateAuditLogs,
  generateChunk,
  generateSyncJobs,
  type SeedConfig,
} from "./perf-seed/generate";
import { assertPerfDatabase } from "./perf-seed/guard";
import { createRng } from "./perf-seed/prng";
import {
  ANALYSES,
  ANALYZE_TABLES,
  AUDIT_LOGS,
  INTENTS,
  MATCHES,
  MEMBERS,
  OVERRIDES,
  POSTS,
  PROJECTS,
  QUERIES,
  RUNS,
  SYNC_JOBS,
  TOPICS,
  TRUNCATE_SQL,
  USERS,
  insertStatements,
} from "./perf-seed/sql";

export class PerfSeedArgsError extends Error {}

const argsSchema = z.object({
  posts: z.coerce.number().int().min(1).max(2_000_000).default(100_000),
  seed: z.coerce.number().int().min(0).default(84),
  days: z.coerce.number().int().min(7).max(3650).default(120),
  anchor: z.iso.datetime({ offset: true }).optional(),
  chunk: z.coerce.number().int().min(100).max(20_000).default(2000),
  truncate: z.boolean().default(false),
  allowAnyDb: z.boolean().default(false),
  databaseUrl: z.string().optional(),
});
export type PerfSeedArgs = z.infer<typeof argsSchema>;

const BOOL_FLAGS = new Set(["truncate", "allow-any-db"]);
const camel = (s: string) => s.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());

/** Parses argv (without node/script). */
export function parsePerfSeedArgs(argv: readonly string[]): PerfSeedArgs {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--") continue;
    if (!a.startsWith("--")) throw new PerfSeedArgsError(`unexpected argument "${a}"`);
    const name = a.slice(2);
    if (BOOL_FLAGS.has(name)) {
      flags[camel(name)] = true;
      continue;
    }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new PerfSeedArgsError(`--${name} requires a value`);
    flags[camel(name)] = v;
    i++;
  }
  const r = argsSchema.strict().safeParse(flags);
  if (!r.success)
    throw new PerfSeedArgsError(r.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "));
  return r.data;
}

/** Default anchor = current hour (UTC) so the default 7-day analytics range hits the burst window. */
export function seedConfig(args: PerfSeedArgs, now: Date = new Date()): SeedConfig {
  const anchor = args.anchor ? new Date(args.anchor) : new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
  return {
    posts: args.posts,
    days: args.days,
    anchor,
    auditLogs: Math.round(args.posts / 5),
    syncJobs: Math.round(args.posts / 50),
  };
}

export type PerfSeedCounts = Record<string, number>;

async function exec(db: PrismaClient, stmts: Prisma.Sql[]): Promise<void> {
  for (const s of stmts) await db.$executeRaw(s);
}

/** Loads the dataset. Caller owns the guard; refuses a non-empty database unless `truncate`. */
export async function runPerfSeed(
  db: PrismaClient,
  args: Pick<PerfSeedArgs, "seed" | "chunk" | "truncate">,
  cfg: SeedConfig,
  onProgress: (done: number) => void = () => undefined,
): Promise<PerfSeedCounts> {
  if (args.truncate) await db.$executeRaw(TRUNCATE_SQL);
  const existing = await db.socialPost.count();
  if (existing > 0) throw new PerfSeedArgsError(`database already has ${existing} posts; pass --truncate to reload`);

  const rng = createRng(args.seed);
  const fx = buildFixture(rng);
  await exec(db, [
    ...insertStatements(USERS, fx.users),
    ...insertStatements(PROJECTS, fx.projects),
    ...insertStatements(
      MEMBERS,
      fx.projects.flatMap((p) =>
        fx.users.map((u, i) => ({
          projectId: p.id,
          userId: u.id,
          role: ["admin", "analyst", "viewer"][i] ?? "viewer",
        })),
      ),
    ),
    ...insertStatements(QUERIES, fx.queries),
  ]);

  const counts: PerfSeedCounts = { posts: 0, matches: 0, runs: 0, analyses: 0, intents: 0, topics: 0, overrides: 0 };
  for (let start = 0; start < cfg.posts; start += args.chunk) {
    const rows = generateChunk(rng, fx, cfg, start, Math.min(args.chunk, cfg.posts - start));
    // One transaction per chunk: the deferrable current_analysis_id FK is checked at commit, after analyses exist.
    await db.$transaction(
      [
        ...insertStatements(POSTS, rows.posts),
        ...insertStatements(MATCHES, rows.matches),
        ...insertStatements(RUNS, rows.runs),
        ...insertStatements(ANALYSES, rows.analyses),
        ...insertStatements(INTENTS, rows.intents),
        ...insertStatements(TOPICS, rows.topics),
        ...insertStatements(OVERRIDES, rows.overrides),
      ].map((s) => db.$executeRaw(s)),
    );
    for (const k of Object.keys(rows) as (keyof typeof rows)[]) counts[k] = (counts[k] ?? 0) + rows[k].length;
    onProgress(start + rows.posts.length);
  }
  const audit = generateAuditLogs(rng, fx, cfg);
  const jobs = generateSyncJobs(rng, fx, cfg);
  await exec(db, [...insertStatements(AUDIT_LOGS, audit), ...insertStatements(SYNC_JOBS, jobs)]);
  counts.auditLogs = audit.length;
  counts.syncJobs = jobs.length;
  // Table names come from the constant ANALYZE_TABLES list, never from input.
  for (const t of ANALYZE_TABLES) await db.$executeRaw(Prisma.sql`ANALYZE ${Prisma.raw(`"${t}"`)}`);
  return counts;
}

async function main(): Promise<void> {
  const args = parsePerfSeedArgs(process.argv.slice(2));
  const url = args.databaseUrl ?? process.env.PERF_DATABASE_URL;
  const target = assertPerfDatabase(url, { allowAnyDb: args.allowAnyDb });
  const cfg = seedConfig(args);
  const db = new PrismaClient({ datasources: { db: { url } } });
  const t0 = Date.now();
  try {
    process.stdout.write(
      `perf:seed → ${target.databaseName} (posts=${cfg.posts}, seed=${args.seed}, anchor=${cfg.anchor.toISOString()})\n`,
    );
    const counts = await runPerfSeed(db, args, cfg, (n) => {
      if (n % 20_000 === 0 || n === cfg.posts) process.stdout.write(`  ${n} posts\n`);
    });
    process.stdout.write(`${JSON.stringify(counts)}\ndone in ${((Date.now() - t0) / 1000).toFixed(1)} s\n`);
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e: unknown) => {
    process.stderr.write(`perf:seed failed: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
}
