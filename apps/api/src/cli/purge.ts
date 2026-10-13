/**
 * `pnpm --filter @how-about-me/api purge -- <scope> [--apply] [--batch-size N] [--actor <userId>]`
 *
 * Retention / purge CLI (T-126, NFR-054, NFR-072) — docs/05-operations/04-data-retention-purge.md §2.
 * Scopes (exactly one):
 *   --post <platform_post_id> [--platform threads]
 *   --project <uuid> --before YYYY-MM-DD
 *   --sync-jobs --before YYYY-MM-DD [--project <uuid>]
 * Dry run by default (counts only). `--before` is a UTC date, exclusive (< 00:00:00Z).
 * Only ids and counts are printed — never post text or usernames.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { z } from "zod";
import type { PrismaService } from "../database/prisma.service";
import { AuditRepository } from "../modules/audit/audit.repository";
import { AuditService } from "../modules/audit/audit.service";
import {
  DEFAULT_PURGE_BATCH_SIZE,
  MAX_PURGE_BATCH_SIZE,
  type PurgeCounts,
  type PurgeScope,
  applyPurge,
  countPurge,
} from "../modules/retention/purge";

export type PurgeArgs = { target: PurgeScope; apply: boolean; batchSize: number; actorUserId: string | null };

const utcDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "--before must be YYYY-MM-DD")
  .transform((v, ctx) => {
    const d = new Date(`${v}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) {
      ctx.addIssue({ code: "custom", message: "--before is not a valid date" });
      return z.NEVER;
    }
    return d;
  });

const common = {
  apply: z.boolean(),
  batchSize: z.coerce.number().int().min(1).max(MAX_PURGE_BATCH_SIZE).default(DEFAULT_PURGE_BATCH_SIZE),
  actor: z.uuid().optional(),
};

const argsSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("post"),
    post: z.string().min(1),
    platform: z.literal("threads").default("threads"),
    project: z.undefined({ message: "--project cannot be combined with --post" }),
    before: z.undefined({ message: "--before cannot be combined with --post" }),
    ...common,
  }),
  // Decision 2026-10-13: --before is mandatory, no implicit RETENTION_*_DAYS default.
  z.object({ scope: z.literal("project"), project: z.uuid(), before: utcDate, ...common }),
  z.object({ scope: z.literal("sync-jobs"), project: z.uuid().optional(), before: utcDate, ...common }),
]);

export class PurgeArgsError extends Error {}

/** Parses argv (without node/script). Throws `PurgeArgsError` with a readable message. */
export function parsePurgeArgs(argv: readonly string[]): PurgeArgs {
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--") continue;
    if (!a.startsWith("--")) throw new PurgeArgsError(`unexpected argument "${a}"`);
    const name = a.slice(2);
    if (name === "apply" || name === "sync-jobs") {
      flags[name] = true;
      continue;
    }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new PurgeArgsError(`--${name} requires a value`);
    flags[name] = v;
    i++;
  }
  const known = new Set(["post", "project", "before", "sync-jobs", "apply", "batch-size", "platform", "actor"]);
  const unknown = Object.keys(flags).find((k) => !known.has(k));
  if (unknown) throw new PurgeArgsError(`unknown option --${unknown}`);

  const scopes = [flags.post !== undefined && "post", flags["sync-jobs"] === true && "sync-jobs"].filter(Boolean);
  if (scopes.length > 1) throw new PurgeArgsError("use exactly one of --post, --project, --sync-jobs");
  const scope = scopes[0] ?? (flags.project !== undefined ? "project" : undefined);
  if (!scope) throw new PurgeArgsError("missing scope: --post <id> | --project <id> --before <date> | --sync-jobs");

  const parsed = argsSchema.safeParse({
    scope,
    post: flags.post,
    platform: flags.platform,
    project: flags.project,
    before: flags.before,
    apply: flags.apply === true,
    batchSize: flags["batch-size"],
    actor: flags.actor,
  });
  if (!parsed.success) {
    throw new PurgeArgsError(parsed.error.issues.map((i) => `${i.path.join(".") || "args"}: ${i.message}`).join("; "));
  }
  const d = parsed.data;
  const target: PurgeScope =
    d.scope === "post"
      ? { scope: "post", platform: d.platform, platformPostId: d.post }
      : d.scope === "project"
        ? { scope: "project", projectId: d.project, before: d.before }
        : { scope: "sync-jobs", before: d.before, ...(d.project ? { projectId: d.project } : {}) };
  return { target, apply: d.apply, batchSize: d.batchSize, actorUserId: d.actor ?? null };
}

export function formatCounts(counts: PurgeCounts): string {
  return Object.entries(counts)
    .map(([k, v]) => `  ${k.padEnd(10)} ${v}`)
    .join("\n");
}

async function main() {
  let args: PurgeArgs;
  try {
    args = parsePurgeArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`purge: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }
  const prisma = new PrismaClient();
  try {
    if (!args.apply) {
      console.log(`purge (${args.target.scope}) — rows that would be deleted:`);
      console.log(formatCounts(await countPurge(prisma, args.target)));
      console.log("DRY RUN — nothing deleted, re-run with --apply");
      return;
    }
    // PrismaService only adds Nest lifecycle hooks; the repository just needs the client.
    const audit = new AuditService(new AuditRepository(prisma as PrismaService), new PinoLogger({}));
    const requestId = randomUUID();
    const counts = await applyPurge(prisma, audit, args.target, {
      batchSize: args.batchSize,
      actorUserId: args.actorUserId,
      requestId,
    });
    console.log(`purge (${args.target.scope}) — deleted (requestId ${requestId}):`);
    console.log(formatCounts(counts));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : "purge failed");
    process.exit(1);
  });
}
