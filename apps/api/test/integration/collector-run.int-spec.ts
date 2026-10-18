import type { INestApplication } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";
import { APP_CONFIG, type AppConfig } from "../../src/config/config.module";
import type { PrismaService } from "../../src/database/prisma.service";
import type { ClaimedQuery } from "../../src/jobs/collector-runner";
import { SchedulerService } from "../../src/jobs/scheduler.service";
import { COLLECTOR_RETRY_OVERRIDES, CollectorService } from "../../src/modules/collector/collector.service";
import type { FakeThreadsProvider } from "../../src/modules/integrations/threads/fake-threads.provider";
import { SOCIAL_DISCOVERY_PROVIDER } from "../../src/modules/integrations/threads/social-discovery.provider";
import { createTestApp, resetDb } from "../helpers/app";

const WORKER = "test-worker";

describe("CollectorService run loop (T-052, doc 06 §5)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let svc: CollectorService;
  let cfg: AppConfig;
  let fake: FakeThreadsProvider;
  let projectId: string;
  let defaultMaxPages: number;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({
      customize: (b) =>
        b.overrideProvider(COLLECTOR_RETRY_OVERRIDES).useValue({ sleep: async () => undefined, random: () => 0 }),
    }));
    svc = app.get(CollectorService);
    cfg = app.get<AppConfig>(APP_CONFIG);
    fake = app.get<FakeThreadsProvider>(SOCIAL_DISCOVERY_PROVIDER);
    defaultMaxPages = cfg.COLLECTOR_MAX_PAGES_PER_JOB;
  });
  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    fake.reset();
    cfg.COLLECTOR_MAX_PAGES_PER_JOB = defaultMaxPages;
    projectId = uuidv7();
    await prisma.monitoringProject.create({ data: { id: projectId, name: "P", slug: `p-${projectId}` } });
    await prisma.integrationConnection.create({
      data: { id: uuidv7(), projectId, platform: "threads", status: "connected" },
    });
  });

  async function seedQuery(value: string, excludeTerms: string[] = []): Promise<ClaimedQuery> {
    const id = uuidv7();
    await prisma.listeningQuery.create({
      data: {
        id,
        projectId,
        displayName: value,
        queryValue: value,
        queryType: "keyword",
        searchMode: "KEYWORD",
        excludeTerms,
        lockedBy: WORKER,
        lockedAt: new Date(),
      },
    });
    return {
      id,
      projectId,
      pollIntervalSeconds: 600,
      consecutiveFailures: 0,
      nextRunAt: null,
      manualJobId: null,
      workerId: WORKER,
    };
  }

  const jobs = (queryId: string) => prisma.syncJob.findMany({ where: { queryId }, orderBy: { createdAt: "asc" } });

  it("TC-COL-007 / FR-073: fake-multipage → 3 pages, all posts, success, cursor cleared, watermark set", async () => {
    const q = await seedQuery("fake-multipage");
    expect((await svc.run(q)).status).toBe("success");
    const [job] = await jobs(q.id);
    expect(job).toMatchObject({
      status: "success",
      trigger: "scheduled",
      pagesFetched: 3,
      recordsFetched: 5,
      recordsInserted: 5,
      providerRequests: 3,
      lastCursor: null,
      lockedBy: null,
    });
    expect(job?.completedAt).not.toBeNull();
    expect(await prisma.socialPost.count()).toBe(5);
    const lq = await prisma.listeningQuery.findUniqueOrThrow({ where: { id: q.id } });
    expect(lq.lastSuccessfulSyncAt?.getTime()).toBe(job?.windowUntil?.getTime());
  });

  it("TC-COL-008 / FR-087: MAX_PAGES=2 → partial with last_cursor; a retry job resumes at page 3", async () => {
    cfg.COLLECTOR_MAX_PAGES_PER_JOB = 2;
    const q = await seedQuery("fake-multipage");
    expect((await svc.run(q)).status).toBe("partial");
    const [first] = await jobs(q.id);
    expect(first).toMatchObject({ status: "partial", pagesFetched: 2, lastCursor: "fake-page-2", errorCode: null });
    expect((await prisma.listeningQuery.findUniqueOrThrow({ where: { id: q.id } })).lastSuccessfulSyncAt).toBeNull();

    // T-055 will create retry jobs this way: copy cursor + window from the partial job.
    const retryId = uuidv7();
    await prisma.syncJob.create({
      data: {
        id: retryId,
        projectId,
        queryId: q.id,
        status: "queued",
        trigger: "retry",
        searchType: "RECENT",
        searchMode: "KEYWORD",
        windowSince: first?.windowSince ?? null,
        windowUntil: first?.windowUntil ?? null,
        lastCursor: "fake-page-2",
      },
    });
    cfg.COLLECTOR_MAX_PAGES_PER_JOB = defaultMaxPages;
    expect((await svc.run({ ...q, manualJobId: retryId })).status).toBe("success");
    const retry = await prisma.syncJob.findUniqueOrThrow({ where: { id: retryId } });
    expect(retry).toMatchObject({ status: "success", pagesFetched: 1, recordsInserted: 1, lastCursor: null });
    expect(retry.windowSince?.getTime()).toBe(first?.windowSince?.getTime());
    expect(await prisma.syncJob.count()).toBe(2);
    expect(await prisma.socialPost.count()).toBe(5);
  });

  it("TC-COL-015 / FR-080: fetched = inserted + updated + duplicated + invalid; excluded counted", async () => {
    const qi = await seedQuery("fake-invalid-items", ["concert"]);
    await svc.run(qi);
    await svc.run(qi);
    const qc = await seedQuery("fake-changed-text");
    await svc.run(qc);
    // The fixture post is older than the overlap; re-open the window so the edit is fetched again.
    await prisma.listeningQuery.update({ where: { id: qc.id }, data: { lastSuccessfulSyncAt: null } });
    await svc.run(qc);
    const all = [...(await jobs(qi.id)), ...(await jobs(qc.id))];
    expect(all).toHaveLength(4);
    for (const j of all)
      expect(j.recordsFetched).toBe(j.recordsInserted + j.recordsUpdated + j.recordsDuplicated + j.recordsInvalid);
    expect(all[0]).toMatchObject({ recordsInserted: 1, recordsExcluded: 1 });
    expect(all[0]?.recordsInvalid).toBeGreaterThanOrEqual(1);
    expect(all[1]).toMatchObject({ recordsDuplicated: 1, recordsExcluded: 1 });
    expect(all[3]).toMatchObject({ recordsUpdated: 1 });
  });

  it("TC-COL-024 / BR-014: failure on page 3 → pages 1–2 committed, partial, watermark unchanged", async () => {
    const q = await seedQuery("fake-fail-page-3");
    const out = await svc.run(q);
    expect(out).toMatchObject({ status: "partial", errorCode: "THREADS_MALFORMED_RESPONSE" });
    const [job] = await jobs(q.id);
    expect(job).toMatchObject({
      status: "partial",
      pagesFetched: 2,
      recordsInserted: 4,
      providerRequests: 3,
      lastCursor: "fake-page-2",
      errorCode: "THREADS_MALFORMED_RESPONSE",
    });
    expect(await prisma.socialPost.count()).toBe(4);
    expect((await prisma.listeningQuery.findUniqueOrThrow({ where: { id: q.id } })).lastSuccessfulSyncAt).toBeNull();
  });

  it("TC-COL-026 / FR-089: provider_usage stored; 429 retry counted in rate_limit_events", async () => {
    const q = await seedQuery("fake-429");
    expect((await svc.run(q)).status).toBe("success");
    const [job] = await jobs(q.id);
    expect(job).toMatchObject({ rateLimitEvents: 1, providerRequests: 2 });
    expect(job?.providerUsage).toMatchObject({
      remaining: expect.any(Number),
      resetAt: expect.any(String),
      raw: { "x-app-usage": expect.any(String) },
      observedAt: expect.any(String),
    });
  });

  it("FR-058: a queued manual job is taken over (queued → success), no extra job", async () => {
    const q = await seedQuery("eventista");
    const manualId = uuidv7();
    await prisma.syncJob.create({
      data: {
        id: manualId,
        projectId,
        queryId: q.id,
        status: "queued",
        trigger: "manual",
        searchType: "RECENT",
        searchMode: "KEYWORD",
      },
    });
    await svc.run({ ...q, manualJobId: manualId });
    expect(await prisma.syncJob.count()).toBe(1);
    const job = await prisma.syncJob.findUniqueOrThrow({ where: { id: manualId } });
    expect(job).toMatchObject({ status: "success", trigger: "manual", pagesFetched: 1 });
    expect(job.windowSince).not.toBeNull();
  });

  it("scheduler tick drives the real runner end to end (next_run_at advanced, lock released)", async () => {
    const q = await seedQuery("eventista");
    await prisma.listeningQuery.update({ where: { id: q.id }, data: { lockedBy: null, lockedAt: null } });
    await app.get(SchedulerService).tick();
    const lq = await prisma.listeningQuery.findUniqueOrThrow({ where: { id: q.id } });
    expect(lq.nextRunAt?.getTime()).toBeGreaterThan(Date.now());
    expect(lq.lockedBy).toBeNull();
    expect(lq.lastSuccessfulSyncAt).not.toBeNull();
    expect((await jobs(q.id))[0]?.status).toBe("success");
  });
});
