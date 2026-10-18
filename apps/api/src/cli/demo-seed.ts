/**
 * `pnpm db:seed:demo [-- --reset] [--seed 294] [--anchor <ISO>]`
 *
 * #294: reproducible demo data for every screen and state — 3 accounts (admin / analyst / viewer), 8 queries,
 * 600 posts over 30 days with versioned analysis (every review reason), overrides, sync jobs, audit, settings and a
 * connected (fake-token) integration. Local Postgres only (see `demo-seed/guard.ts`). Re-runs converge: demo rows
 * are found by deterministic id / marker and replaced in one transaction. Never prints the URL, keys or passwords.
 */
import { ProjectSettingsSchema } from "@how-about-me/contracts";
import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { runSeed } from "../../prisma/seed";
import { CryptoService } from "../common/crypto/crypto.service";
import { loadEnv } from "../config/env.schema";
import { buildDemoDataset } from "./demo-seed/generate";
import { assertDemoTarget } from "./demo-seed/guard";
import { DEMO_POST_PREFIX } from "./demo-seed/posts";
import type { BaseQuery, DemoDataset, DemoUsers } from "./demo-seed/types";
import { seedAuthUserFor } from "./seed-auth-user";

export class DemoSeedArgsError extends Error {}

const argsSchema = z
  .object({
    reset: z.boolean().default(false),
    seed: z.coerce.number().int().min(0).default(294),
    anchor: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();
export type DemoSeedArgs = z.infer<typeof argsSchema>;

/** Parses argv (without node/script). */
export function parseDemoSeedArgs(argv: readonly string[]): DemoSeedArgs {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--") continue;
    if (!a.startsWith("--")) throw new DemoSeedArgsError(`unexpected argument "${a}"`);
    const name = a.slice(2);
    if (name === "reset") {
      flags.reset = true;
      continue;
    }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new DemoSeedArgsError(`--${name} requires a value`);
    flags[name] = v;
    i++;
  }
  const r = argsSchema.safeParse(flags);
  if (!r.success)
    throw new DemoSeedArgsError(r.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "));
  return r.data;
}

/** Default anchor = start of the current UTC hour: data is always "the last 30 days", stable within the hour. */
export function demoAnchor(args: DemoSeedArgs, now: Date = new Date()): Date {
  if (args.anchor) return new Date(args.anchor);
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

const ACCOUNTS = [
  { role: UserRole.admin, emailVar: "SEED_ADMIN_EMAIL", pwVar: "SEED_ADMIN_PASSWORD", fallback: "admin@example.com" },
  {
    role: UserRole.analyst,
    emailVar: "SEED_ANALYST_EMAIL",
    pwVar: "SEED_ANALYST_PASSWORD",
    fallback: "analyst@example.com",
  },
  {
    role: UserRole.viewer,
    emailVar: "SEED_VIEWER_EMAIL",
    pwVar: "SEED_VIEWER_PASSWORD",
    fallback: "viewer@example.com",
  },
] as const;

type Log = (m: string) => void;

async function ensureAccounts(prisma: PrismaClient, projectId: string, adminId: string, log: Log): Promise<DemoUsers> {
  const env = process.env;
  const ids: Record<string, string> = {};
  for (const a of ACCOUNTS) {
    const email = (env[a.emailVar] ?? a.fallback).trim().toLowerCase();
    try {
      await seedAuthUserFor(
        { url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY, email, password: env[a.pwVar] },
        { fetch: (u, i) => fetch(u, i), log },
      );
    } catch (e) {
      log(`warning: auth user ${email} not ensured (${e instanceof Error ? e.message : "unknown error"})`);
    }
    if (a.role === UserRole.admin) {
      ids.admin = adminId;
      continue;
    }
    // Same as runSeed: reuse a logged-in profile (id = auth id) or create a placeholder re-keyed on first login.
    const name = a.role === UserRole.analyst ? "Analyst (demo)" : "Viewer (demo)";
    const profile =
      (await prisma.userProfile.findUnique({ where: { email } })) ??
      (await prisma.userProfile.create({ data: { id: uuidv7(), email, displayName: name } }));
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: profile.id } },
      update: { role: a.role },
      create: { projectId, userId: profile.id, role: a.role, invitedEmail: email, createdBy: adminId },
    });
    ids[a.role] = profile.id;
  }
  const { admin, analyst, viewer } = ids;
  if (!admin || !analyst || !viewer) throw new Error("demo seed: accounts not resolved");
  return { admin, analyst, viewer };
}

async function ensureIntegration(prisma: PrismaClient, projectId: string, anchor: Date, log: Log) {
  const conn = await prisma.integrationConnection.upsert({
    where: { projectId_platform: { projectId, platform: "threads" } },
    update: {},
    create: { id: uuidv7(), projectId, platform: "threads" },
  });
  await prisma.integrationConnection.update({
    where: { id: conn.id },
    data: {
      status: "connected",
      accountIdentifier: "demo_threads_account",
      grantedScopes: ["threads_basic", "threads_keyword_search"],
      tokenExpiresAt: new Date(anchor.getTime() + 5 * 86_400_000),
      lastVerifiedAt: anchor,
      lastSuccessAt: anchor,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastErrorAt: null,
    },
  });
  let crypto: CryptoService;
  try {
    crypto = new CryptoService(loadEnv());
  } catch {
    log("warning: INTEGRATION_ENCRYPTION_KEYS not usable — integration secret skipped");
    return;
  }
  // Fake, clearly-not-a-token value; AAD = connection id like every real secret (ADR-0012).
  const enc = crypto.encrypt("fake-demo-token-not-real", conn.id);
  const data = {
    keyId: enc.keyId,
    ciphertext: Uint8Array.from(enc.ciphertext),
    iv: Uint8Array.from(enc.iv),
    authTag: Uint8Array.from(enc.authTag),
  };
  await prisma.integrationSecret.upsert({
    where: { connectionId: conn.id },
    update: data,
    create: { id: uuidv7(), connectionId: conn.id, ...data },
  });
}

async function writeDataset(prisma: PrismaClient, projectId: string, d: DemoDataset, reset: boolean) {
  await prisma.$transaction(
    async (tx) => {
      // Cascades runs, analyses (+ intents/topics/phrases), matches and overrides.
      await tx.socialPost.deleteMany({ where: { projectId, platformPostId: { startsWith: DEMO_POST_PREFIX } } });
      await tx.syncJob.deleteMany({ where: { projectId, lockedBy: "demo-seed" } });
      await tx.auditLog.deleteMany({ where: { projectId, metadata: { path: ["demo"], equals: true } } });
      await tx.listeningQuery.deleteMany({ where: { id: { in: d.queries.map((q) => q.id) } } });
      if (reset) await tx.analysisSetting.deleteMany({ where: { id: { in: d.analysisSettings.map((s) => s.id) } } });

      // BR-018: analysis settings are append-only — only add versions the project does not have yet.
      for (const s of d.analysisSettings) {
        const exists = await tx.analysisSetting.findUnique({
          where: { projectId_version: { projectId, version: s.version } },
        });
        if (!exists) await tx.analysisSetting.create({ data: { ...s, projectId } });
      }
      await tx.listeningQuery.createMany({ data: d.queries.map((q) => ({ ...q, projectId })) });
      // current_analysis_id FK is DEFERRABLE INITIALLY DEFERRED, so posts may point at analyses inserted below.
      await tx.socialPost.createMany({
        data: d.posts.map(({ lang: _lang, ...p }) => ({
          ...p,
          projectId,
          platform: "threads",
          mediaType: "TEXT_POST",
        })),
      });
      await tx.postQueryMatch.createMany({ data: d.matches });
      await tx.analysisRun.createMany({
        data: d.runs.map(({ policyVersion, ...r }) => ({
          ...r,
          projectId,
          classifierProvider: "fake",
          classifierModel: "fake-classifier-v1",
          promptVersion: "fake-v2",
          taxonomyVersion: r.effectiveVersion.split("|")[3] ?? null,
          safetyProvider: "fake",
          safetyModel: "fake-moderation-v1",
          safetyPolicyVersion: policyVersion,
          estimatedCostUsd: 0,
        })),
      });
      await tx.postAnalysis.createMany({
        data: d.analyses.map(({ intents: _i, topics: _t, phrases: _p, ...a }) => ({ ...a, projectId })),
      });
      await tx.analysisIntent.createMany({
        data: d.analyses.flatMap((a) => a.intents.map((x) => ({ analysisId: a.id, ...x }))),
      });
      await tx.analysisTopic.createMany({
        data: d.analyses.flatMap((a) => a.topics.map((x) => ({ analysisId: a.id, ...x }))),
      });
      await tx.analysisPhrase.createMany({
        data: d.analyses.flatMap((a) => a.phrases.map((phrase, position) => ({ analysisId: a.id, phrase, position }))),
      });
      await tx.analysisOverride.createMany({ data: d.overrides.map((o) => ({ ...o, projectId })) });
      await tx.syncJob.createMany({ data: d.syncJobs.map((j) => ({ ...j, projectId, lockedBy: "demo-seed" })) });
      await tx.auditLog.createMany({
        data: d.auditLogs.map((l) => ({ ...l, projectId, metadata: l.metadata as Prisma.InputJsonObject })),
      });
      await tx.collectorState.upsert({
        where: { projectId },
        update: { ...d.collectorState, circuitOpenUntil: null, circuitReason: null },
        create: { projectId, ...d.collectorState },
      });
      const project = await tx.monitoringProject.findUniqueOrThrow({ where: { id: projectId } });
      const current = typeof project.settings === "object" && project.settings !== null ? project.settings : {};
      const settings = ProjectSettingsSchema.parse({ ...current, ...d.projectSettings });
      await tx.monitoringProject.update({ where: { id: projectId }, data: { settings } });
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}

async function main() {
  const args = parseDemoSeedArgs(process.argv.slice(2));
  const target = assertDemoTarget(process.env.DATABASE_URL, process.env);
  const log: Log = (m) => console.log(m);
  log(
    `db:seed:demo → database "${target.databaseName}" on ${target.host} (seed ${args.seed}${args.reset ? ", reset" : ""})`,
  );
  const anchor = demoAnchor(args);
  const prisma = new PrismaClient();
  try {
    const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
    const { projectId, adminUserId } = await runSeed(prisma, { adminEmail, log });
    if (!adminUserId) throw new Error("demo seed: admin not seeded");
    if (args.reset) {
      const others = await prisma.userProfile.findMany({
        where: {
          email: {
            in: ACCOUNTS.filter((a) => a.role !== UserRole.admin).map((a) =>
              (process.env[a.emailVar] ?? a.fallback).trim().toLowerCase(),
            ),
          },
        },
        select: { id: true },
      });
      await prisma.projectMember.deleteMany({ where: { projectId, userId: { in: others.map((o) => o.id) } } });
    }
    const users = await ensureAccounts(prisma, projectId, adminUserId, log);
    const baseRows = await prisma.listeningQuery.findMany({
      where: { projectId, deletedAt: null, queryValue: { in: ["1zone", "eventista"] } },
      select: { id: true, queryType: true, queryValue: true },
    });
    const baseQueries: BaseQuery[] = baseRows.map((q) => ({
      id: q.id,
      queryType: q.queryType,
      queryValue: q.queryValue,
    }));
    const dataset = buildDemoDataset({ seed: args.seed, anchor, projectId, users, baseQueries });
    await writeDataset(prisma, projectId, dataset, args.reset);
    await ensureIntegration(prisma, projectId, anchor, log);
    log(
      `demo data: ${dataset.queries.length + baseQueries.length} queries, ${dataset.posts.length} posts, ` +
        `${dataset.runs.length} runs, ${dataset.analyses.length} analyses, ${dataset.overrides.length} overrides, ` +
        `${dataset.syncJobs.length} sync jobs, ${dataset.auditLogs.length} audit logs (anchor ${anchor.toISOString()})`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : "db:seed:demo failed");
    process.exit(1);
  });
}
