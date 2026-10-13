import type { INestApplication } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import type { PinoLogger } from "nestjs-pino";
import { v7 as uuidv7 } from "uuid";
import { APP_CONFIG, type AppConfig } from "../../src/config/config.module";
import { PrismaService } from "../../src/database/prisma.service";
import { AnalysisPipelineService } from "../../src/modules/analysis/analysis-pipeline.service";
import { AnalysisWorkerService } from "../../src/modules/analysis/analysis-worker.service";
import { AnalysisService, type ClaimedRun } from "../../src/modules/analysis/analysis.service";
import {
  CONTENT_CLASSIFIER,
  SAFETY_PROVIDER,
  type ContentClassifier,
  type SafetyProvider,
} from "../../src/modules/analysis/providers/interfaces";
import { IngestionService, type IngestionQuery } from "../../src/modules/collector/ingestion.service";
import { normalizeItem, type NormalizedPost } from "../../src/modules/collector/post-normalizer";
import { createTestApp, resetDb } from "../helpers/app";

function post(id: string, text: string): NormalizedPost {
  const r = normalizeItem({ id, text, timestamp: "2026-10-01T10:00:00+0000", username: "u" });
  if (!r.ok) throw new Error("fixture invalid");
  return r.post;
}

const silent = { info: () => undefined, warn: () => undefined, error: () => undefined } as unknown as PinoLogger;

describe("Analysis runs (T-070)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let svc: AnalysisService;
  let ingest: IngestionService;
  let cfg: AppConfig;
  let projectId: string;
  let q: IngestionQuery;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    svc = app.get(AnalysisService);
    ingest = app.get(IngestionService);
    cfg = app.get<AppConfig>(APP_CONFIG);
  });
  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    projectId = uuidv7();
    await prisma.monitoringProject.create({ data: { id: projectId, name: "P", slug: `p-${projectId}` } });
    const id = uuidv7();
    await prisma.listeningQuery.create({
      data: { id, projectId, displayName: "1zone", queryValue: "1zone", queryType: "keyword", searchMode: "KEYWORD" },
    });
    q = { id, projectId, platform: "threads", includeTerms: [], excludeTerms: [] };
  });

  async function seedRuns(n: number): Promise<void> {
    await ingest.ingestPage(
      q,
      Array.from({ length: n }, (_, i) => post(`p${i}`, `1zone ${i}`)),
    );
  }

  function worker(processor: { process(run: ClaimedRun): Promise<void> }): AnalysisWorkerService {
    return new AnalysisWorkerService(svc, app.get(SchedulerRegistry), cfg, silent, processor);
  }

  it("TC-ANA-002 / FR-101: two workers claim 50 pending runs without overlap", async () => {
    await seedRuns(50);
    const claimed = new Map<string, string>();
    const drain = async (w: string) => {
      for (;;) {
        const batch = await svc.claimBatch(w, 7);
        if (batch.length === 0) return;
        for (const r of batch) {
          expect(claimed.has(r.id)).toBe(false);
          claimed.set(r.id, w);
        }
      }
    };
    await Promise.all([drain("w1"), drain("w2")]);
    expect(claimed.size).toBe(50);
    const runs = await prisma.analysisRun.findMany();
    for (const r of runs) {
      expect(r).toMatchObject({ status: "processing", attemptCount: 1, lockedBy: claimed.get(r.id) });
    }
    const posts = await prisma.socialPost.findMany();
    expect(posts.every((p) => p.latestRunStatus === "processing")).toBe(true);
  });

  it("TC-ANA-002 / FR-101: four workers on separate connection pools claim disjoint batches", async () => {
    // Each worker gets its own PrismaClient (own pool), like separate worker processes.
    await seedRuns(80);
    const clients = Array.from({ length: 4 }, () => new PrismaService());
    try {
      await Promise.all(clients.map((c) => c.$connect()));
      const services = clients.map(
        (c) =>
          new AnalysisService(
            c,
            cfg,
            app.get<ContentClassifier>(CONTENT_CLASSIFIER),
            app.get<SafetyProvider>(SAFETY_PROVIDER),
          ),
      );
      const owner = new Map<string, string>();
      const duplicates: string[] = [];
      await Promise.all(
        services.map(async (s, i) => {
          for (;;) {
            const batch = await s.claimBatch(`proc-${i}`, 3);
            if (batch.length === 0) return;
            for (const r of batch) {
              if (owner.has(r.id)) duplicates.push(r.id);
              owner.set(r.id, `proc-${i}`);
            }
          }
        }),
      );
      expect(duplicates).toEqual([]);
      expect(owner.size).toBe(80);
      const runs = await prisma.analysisRun.findMany();
      expect(runs.every((r) => r.status === "processing" && r.attemptCount === 1)).toBe(true);
      expect(runs.every((r) => r.lockedBy === owner.get(r.id))).toBe(true);
    } finally {
      await Promise.all(clients.map((c) => c.$disconnect()));
    }
  });

  it("TC-ANA-002 / FR-101: two worker ticks process each run exactly once", async () => {
    await seedRuns(50);
    const calls = new Map<string, number>();
    const mk = () => {
      const w: AnalysisWorkerService = worker({
        process: async (run) => {
          calls.set(run.id, (calls.get(run.id) ?? 0) + 1);
          await svc.markCompleted(run.id, w.workerId);
        },
      });
      return w;
    };
    const [w1, w2] = [mk(), mk()];
    while ((await prisma.analysisRun.count({ where: { status: "pending" } })) > 0) {
      await Promise.all([w1.tick(), w2.tick()]);
    }
    expect(calls.size).toBe(50);
    expect([...calls.values()].every((n) => n === 1)).toBe(true);
    expect(await prisma.analysisRun.count({ where: { status: "completed" } })).toBe(50);
    expect((await prisma.socialPost.findMany()).every((p) => p.latestRunStatus === "completed")).toBe(true);
  });

  it("TC-ANA-003: stuck processing > 10 min goes back to pending; 9 min untouched; exhausted → failed", async () => {
    await seedRuns(3);
    await svc.claimBatch("dead", 3);
    const [a, b, c] = await prisma.analysisRun.findMany({ orderBy: { id: "asc" } });
    if (!a || !b || !c) throw new Error("seed");
    const ago = (m: number) => new Date(Date.now() - m * 60_000);
    await prisma.analysisRun.update({ where: { id: a.id }, data: { lockedAt: ago(11) } });
    await prisma.analysisRun.update({ where: { id: b.id }, data: { lockedAt: ago(9) } });
    await prisma.analysisRun.update({
      where: { id: c.id },
      data: { lockedAt: ago(11), attemptCount: cfg.ANALYSIS_MAX_ATTEMPTS },
    });

    // One tick of a worker with a no-op processor (watchdog runs first; claim may pick `a` back up).
    expect(await svc.requeueStuck()).toEqual({ requeued: 1, failed: 1 });

    const after = async (id: string) => prisma.analysisRun.findUniqueOrThrow({ where: { id } });
    expect(await after(a.id)).toMatchObject({ status: "pending", lockedAt: null, lockedBy: null });
    expect(await after(b.id)).toMatchObject({ status: "processing", lockedBy: "dead" });
    expect(await after(c.id)).toMatchObject({
      status: "failed",
      errorCode: "ANALYSIS_PROVIDER_ERROR",
      errorMessage: "stuck_processing_timeout",
    });
    const postOf = async (postId: string) =>
      (await prisma.socialPost.findUniqueOrThrow({ where: { id: postId } })).latestRunStatus;
    expect(await postOf(a.postId)).toBe("pending");
    expect(await postOf(c.postId)).toBe("failed");
  });

  it("TC-ANA-003: a worker tick runs the watchdog", async () => {
    await seedRuns(1);
    await svc.claimBatch("dead", 1);
    await prisma.analysisRun.updateMany({ data: { lockedAt: new Date(Date.now() - 11 * 60_000) } });
    const seen: number[] = [];
    await worker({ process: async (r) => void seen.push(r.attemptCount) }).tick();
    expect(seen).toEqual([2]);
  });

  it("guarded transitions: a stale worker cannot complete a run the watchdog re-queued", async () => {
    await seedRuns(1);
    const [run] = await svc.claimBatch("slow", 1);
    if (!run) throw new Error("seed");
    await prisma.analysisRun.update({ where: { id: run.id }, data: { lockedAt: new Date(Date.now() - 11 * 60_000) } });
    await svc.requeueStuck();
    expect(await svc.markCompleted(run.id, "slow")).toBe(false);
    expect(await svc.markSkipped(run.id, "slow", "empty_text")).toBe(false);
    expect((await prisma.analysisRun.findUniqueOrThrow({ where: { id: run.id } })).status).toBe("pending");
  });

  it("requeue: pending while attempts remain, failed at ANALYSIS_MAX_ATTEMPTS", async () => {
    await seedRuns(1);
    for (let i = 1; i < cfg.ANALYSIS_MAX_ATTEMPTS; i++) {
      const [r] = await svc.claimBatch("w", 1);
      if (!r) throw new Error("seed");
      expect(await svc.requeue(r.id, "w", "ANALYSIS_PROVIDER_ERROR")).toBe("pending");
    }
    const [r] = await svc.claimBatch("w", 1);
    if (!r) throw new Error("seed");
    expect(await svc.requeue(r.id, "w", "ANALYSIS_PROVIDER_ERROR")).toBe("failed");
    const row = await prisma.analysisRun.findUniqueOrThrow({ where: { id: r.id } });
    expect(row).toMatchObject({
      status: "failed",
      attemptCount: cfg.ANALYSIS_MAX_ATTEMPTS,
      errorCode: "ANALYSIS_PROVIDER_ERROR",
    });
    expect((await prisma.socialPost.findUniqueOrThrow({ where: { id: r.postId } })).latestRunStatus).toBe("failed");
  });

  it("markFailed / markSkipped set terminal state and latest_run_status", async () => {
    await seedRuns(2);
    const [x, y] = await svc.claimBatch("w", 2);
    if (!x || !y) throw new Error("seed");
    expect(await svc.markFailed(x.id, "w", "ANALYSIS_SCHEMA_INVALID", "schema")).toBe(true);
    expect(await svc.markSkipped(y.id, "w", "superseded")).toBe(true);
    expect(await prisma.analysisRun.findUniqueOrThrow({ where: { id: y.id } })).toMatchObject({
      status: "skipped",
      skippedReason: "superseded",
    });
    expect((await prisma.socialPost.findUniqueOrThrow({ where: { id: x.postId } })).latestRunStatus).toBe("failed");
  });

  describe("enqueue dedupe (FR-116, BR-023, BR-024)", () => {
    async function base() {
      await seedRuns(1);
      const run = await prisma.analysisRun.findFirstOrThrow();
      const input = {
        postId: run.postId,
        projectId,
        contentHash: run.sourceContentHash,
        revision: 1,
      };
      return { run, input };
    }

    it("TC-ANA-020 / FR-116: completed run blocks ingest re-enqueue; manual forces a new run", async () => {
      const { run, input } = await base();
      await prisma.analysisRun.update({ where: { id: run.id }, data: { status: "completed" } });
      expect(await prisma.$transaction((tx) => svc.enqueueDetailed(tx, { ...input, trigger: "ingest" }))).toEqual({
        created: false,
        reason: "already_analyzed",
      });
      expect(await prisma.analysisRun.count()).toBe(1);
      const forced = await prisma.$transaction((tx) => svc.enqueueDetailed(tx, { ...input, trigger: "manual" }));
      expect(forced.created).toBe(true);
      expect(await prisma.analysisRun.count()).toBe(2);
    });

    it("BR-024: an open run blocks even a manual enqueue", async () => {
      const { input } = await base();
      expect(await prisma.$transaction((tx) => svc.enqueueDetailed(tx, { ...input, trigger: "manual" }))).toEqual({
        created: false,
        reason: "already_open",
      });
      expect(await prisma.analysisRun.count()).toBe(1);
    });

    it("FR-116: a different content hash creates a new run", async () => {
      const { run, input } = await base();
      await prisma.analysisRun.update({ where: { id: run.id }, data: { status: "completed" } });
      expect(
        await prisma.$transaction((tx) => svc.enqueue(tx, { ...input, contentHash: "other", trigger: "ingest" })),
      ).toBe(true);
    });

    it("BR-023: a different effective_version creates a new run", async () => {
      const { run, input } = await base();
      await prisma.analysisRun.update({
        where: { id: run.id },
        data: { status: "completed", effectiveVersion: "old|model|v0" },
      });
      expect(await prisma.$transaction((tx) => svc.enqueue(tx, { ...input, trigger: "ingest" }))).toBe(true);
      expect((await prisma.analysisRun.findMany({ where: { status: "pending" } }))[0]?.effectiveVersion).toBe(
        svc.effectiveVersion,
      );
    });
  });

  describe("stale marking (T-078: FR-078, FR-100, BR-003, BR-023)", () => {
    const OLD = "old|model|v0";

    it("BR-023 / FR-100: markVersionStale stales only pending/completed runs of the old version", async () => {
      await seedRuns(5);
      const runs = await prisma.analysisRun.findMany({ orderBy: { id: "asc" } });
      const statuses = ["completed", "pending", "processing", "failed"] as const;
      for (const [i, st] of statuses.entries()) {
        const r = runs[i];
        if (!r) throw new Error("seed");
        await prisma.analysisRun.update({ where: { id: r.id }, data: { status: st, effectiveVersion: OLD } });
      }
      const current = runs[4];
      if (!current) throw new Error("seed");
      await prisma.analysisRun.update({ where: { id: current.id }, data: { status: "completed" } });

      // Project filter: another project matches nothing.
      expect(await svc.markVersionStale(OLD, { projectId: uuidv7() })).toEqual({ marked: 0 });
      expect(await svc.markVersionStale(OLD, { projectId })).toEqual({ marked: 2 });

      const byId = async (id: string) => prisma.analysisRun.findUniqueOrThrow({ where: { id } });
      const got = await Promise.all(runs.map((r) => byId(r.id)));
      expect(got.map((r) => r.status)).toEqual(["stale", "stale", "processing", "failed", "completed"]);
      const latest = async (postId: string) =>
        (await prisma.socialPost.findUniqueOrThrow({ where: { id: postId } })).latestRunStatus;
      expect(await latest(got[0]?.postId ?? "")).toBe("stale");
      expect(await latest(got[1]?.postId ?? "")).toBe("stale");
    });

    it("BR-023: markVersionStale refuses the current effective_version and changes nothing", async () => {
      await seedRuns(1);
      await prisma.analysisRun.updateMany({ data: { status: "completed" } });
      await expect(svc.markVersionStale(svc.effectiveVersion)).rejects.toThrow(/current effective_version/);
      expect(await prisma.analysisRun.count({ where: { status: "completed" } })).toBe(1);
    });

    it("FR-078 / BR-003: markCurrentStale skips processing runs and runs of the same hash, returns the count", async () => {
      await seedRuns(3);
      const [a, b, c] = await prisma.analysisRun.findMany({ orderBy: { id: "asc" } });
      if (!a || !b || !c) throw new Error("seed");
      await prisma.analysisRun.update({ where: { id: a.id }, data: { status: "completed" } });
      await prisma.analysisRun.update({ where: { id: b.id }, data: { status: "processing" } });
      await prisma.analysisRun.update({ where: { id: c.id }, data: { status: "completed" } });

      expect(await prisma.$transaction((tx) => svc.markCurrentStale(tx, a.postId, "new-hash"))).toBe(1);
      expect(await prisma.$transaction((tx) => svc.markCurrentStale(tx, b.postId, "new-hash"))).toBe(0);
      expect(await prisma.$transaction((tx) => svc.markCurrentStale(tx, c.postId, c.sourceContentHash))).toBe(0);

      const st = async (id: string) => (await prisma.analysisRun.findUniqueOrThrow({ where: { id } })).status;
      expect([await st(a.id), await st(b.id), await st(c.id)]).toEqual(["stale", "processing", "completed"]);
    });

    it("TC-ANA-024 / FR-078: edit → old run stale → worker completes the new run", async () => {
      const w: AnalysisWorkerService = worker({
        process: async (run) => void (await svc.markCompleted(run.id, w.workerId)),
      });
      await ingest.ingestPage(q, [post("edit", "1zone v1")]);
      await w.tick();
      const [first] = await prisma.analysisRun.findMany();
      expect(first?.status).toBe("completed");

      await ingest.ingestPage(q, [post("edit", "1zone v2 edited")]);
      const runs = await prisma.analysisRun.findMany({ orderBy: { id: "asc" } });
      expect(runs.map((r) => r.status)).toEqual(["stale", "pending"]);
      const p = await prisma.socialPost.findFirstOrThrow();
      expect(p).toMatchObject({ revision: 2, latestRunStatus: "pending" });

      await w.tick();
      const after = await prisma.analysisRun.findMany({ orderBy: { id: "asc" } });
      expect(after.map((r) => r.status)).toEqual(["stale", "completed"]);
      expect((await prisma.socialPost.findFirstOrThrow()).latestRunStatus).toBe("completed");
    });

    it("TC-ANA-024: current_analysis_id points to the new analysis after the re-run (#67)", async () => {
      const w = worker(app.get(AnalysisPipelineService));
      await ingest.ingestPage(q, [post("edit2", "1zone v1")]);
      await w.tick();
      await ingest.ingestPage(q, [post("edit2", "1zone v2 edited")]);
      await w.tick();
      const [, second] = await prisma.analysisRun.findMany({ orderBy: { id: "asc" } });
      const current = await prisma.postAnalysis.findUniqueOrThrow({ where: { analysisRunId: second?.id } });
      expect((await prisma.socialPost.findFirstOrThrow()).currentAnalysisId).toBe(current.id);
    });
  });
});
