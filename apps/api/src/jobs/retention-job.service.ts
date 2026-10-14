import { Inject, Injectable, type BeforeApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import { randomUUID } from "node:crypto";
import { PinoLogger } from "nestjs-pino";
import { APP_CONFIG, type AppConfig } from "../config/config.module";
import { PrismaService } from "../database/prisma.service";
import { AuditService } from "../modules/audit/audit.service";
import { applyPurge, countPurge, type PurgeCounts, type PurgeScope } from "../modules/retention/purge";
import { buildRetentionScopes } from "./retention-plan";
import { runWithConcurrency } from "./run-with-concurrency";

export const RETENTION_CRON_JOB = "retention-job";
const SHUTDOWN_WAIT_MS = 30_000;

const sum = (c: PurgeCounts): number => Object.values(c).reduce<number>((a, v) => a + v, 0);
/** Log-safe scope description: ids, dates and counts only (no text/usernames). */
const describeScope = (s: PurgeScope) =>
  s.scope === "post"
    ? { scope: s.scope }
    : { scope: s.scope, projectId: s.projectId ?? null, before: s.before.toISOString() };

/**
 * Scheduled retention job (T-153, NFR-054) — docs/05-operations/04-data-retention-purge.md §2.
 * Registered only when RETENTION_JOB_MODE ≠ off, APP_ROLE ∈ {worker, all} and NODE_ENV ≠ test.
 * Every scope logs dry-run counts first; deletes happen only in `apply` mode. No cross-instance lock:
 * purge is idempotent and empty batches write no audit (decision 5).
 */
@Injectable()
export class RetentionJobService implements OnModuleInit, BeforeApplicationShutdown {
  private current: Promise<void> | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly registry: SchedulerRegistry,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RetentionJobService.name);
  }

  onModuleInit() {
    const { RETENTION_JOB_MODE: mode, RETENTION_JOB_CRON: cron, RETENTION_JOB_TIMEZONE: tz } = this.cfg;
    if (mode === "off") return;
    if (this.cfg.APP_ROLE !== "worker" && this.cfg.APP_ROLE !== "all") return;
    if (this.cfg.NODE_ENV === "test") return;
    const job = CronJob.from({ cronTime: cron, onTick: () => void this.run(), start: false, timeZone: tz });
    this.registry.addCronJob(RETENTION_CRON_JOB, job);
    job.start();
    this.logger.info({ mode, cron, tz }, "retention job scheduled");
  }

  /** One run; an overlapping call in the same instance returns the in-flight run. */
  run(now: Date = new Date()): Promise<void> {
    if (this.current) {
      this.logger.info("retention job skipped: previous run still in progress");
      return this.current;
    }
    this.current = this.doRun(now).finally(() => {
      this.current = null;
    });
    return this.current;
  }

  private async doRun(now: Date): Promise<void> {
    const mode = this.cfg.RETENTION_JOB_MODE;
    const requestId = randomUUID();
    const started = Date.now();
    let scopes: PurgeScope[];
    try {
      const projects = await this.prisma.monitoringProject.findMany({ select: { id: true }, orderBy: { id: "asc" } });
      scopes = buildRetentionScopes(
        projects.map((p) => p.id),
        this.cfg,
        now,
      );
    } catch (err: unknown) {
      this.logger.error({ err, requestId }, "retention job failed to load projects");
      return;
    }
    let wouldDelete = 0;
    let deleted = 0;
    let failed = 0;
    // Sequential (limit 1); one scope's failure is logged and the next scope still runs.
    await runWithConcurrency(scopes, 1, async (scope) => {
      const ctx = { requestId, mode, ...describeScope(scope) };
      try {
        const counts = await countPurge(this.prisma, scope);
        wouldDelete += sum(counts);
        this.logger.info({ ...ctx, counts }, "retention dry-run");
        if (mode !== "apply" || sum(counts) === 0) return;
        const applied = await applyPurge(this.prisma, this.audit, scope, { requestId, actorUserId: null });
        deleted += sum(applied);
        this.logger.info({ ...ctx, counts: applied }, "retention applied");
      } catch (err: unknown) {
        failed++;
        this.logger.error({ ...ctx, err }, "retention scope failed");
      }
    });
    this.logger.info(
      { requestId, mode, scopes: scopes.length, wouldDelete, deleted, failed, durationMs: Date.now() - started },
      "retention job done",
    );
  }

  async beforeApplicationShutdown() {
    if (this.registry.doesExist("cron", RETENTION_CRON_JOB)) {
      void this.registry.getCronJob(RETENTION_CRON_JOB).stop();
      this.registry.deleteCronJob(RETENTION_CRON_JOB);
    }
    if (this.current) {
      await Promise.race([this.current, new Promise<void>((r) => setTimeout(r, SHUTDOWN_WAIT_MS).unref())]);
    }
  }
}
