import type { PinoLogger } from "nestjs-pino";
import { ProviderError } from "../../common/errors/provider.error";
import type { AppConfig } from "../../config/config.module";
import type { PrismaService } from "../../database/prisma.service";
import type { ClaimedQuery } from "../../jobs/collector-runner";
import type { SearchPage, SocialDiscoveryProvider } from "../integrations/threads/social-discovery.provider";
import type { SyncJobRecorder } from "../sync-jobs/sync-job.recorder";
import { CollectorService } from "./collector.service";
import type { IngestionService } from "./ingestion.service";

const NOW = Date.now();
const item = (id: string, minutesAgo: number) => ({
  id,
  text: `t ${id}`,
  timestamp: new Date(NOW - minutesAgo * 60_000).toISOString(),
});
const page = (items: SearchPage["items"], nextCursor?: string): SearchPage => ({
  items,
  ...(nextCursor ? { nextCursor } : {}),
  rateLimit: { remaining: 10, resetAt: new Date(NOW + 3_600_000), raw: { "x-app-usage": "1", authorization: "x" } },
  requestDurationMs: 1,
});

const claimed: ClaimedQuery = {
  id: "q1",
  projectId: "p1",
  pollIntervalSeconds: 600,
  consecutiveFailures: 0,
  nextRunAt: null,
  manualJobId: null,
  workerId: "w1",
};

function setup(
  pages: (SearchPage | Error)[],
  opts: { maxPages?: number; searchType?: "RECENT" | "TOP"; lastSuccessfulSyncAt?: Date | null } = {},
) {
  const query = {
    id: "q1",
    projectId: "p1",
    queryValue: "1zone",
    searchMode: "KEYWORD",
    scheduledSearchType: opts.searchType ?? "RECENT",
    includeTerms: [],
    excludeTerms: [],
    overlapSeconds: 1200,
    initialBackfillDays: 1,
    lastSuccessfulSyncAt: opts.lastSuccessfulSyncAt ?? null,
  };
  const prisma = {
    listeningQuery: {
      findFirst: jest.fn().mockResolvedValue(query),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const cfg = {
    COLLECTOR_MAX_WINDOW_DAYS: 30,
    COLLECTOR_MAX_PAGES_PER_JOB: opts.maxPages ?? 50,
    COLLECTOR_PAGE_LIMIT: 50,
    COLLECTOR_MAX_RETRIES: 3,
  } as AppConfig;
  const queue = [...pages];
  const search = jest.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error("no more pages");
    if (next instanceof Error) throw next;
    return next;
  });
  const provider = { platform: "threads", search, verifyConnection: jest.fn() } as unknown as SocialDiscoveryProvider;
  const tokens = { getAccessToken: jest.fn().mockResolvedValue("tok") };
  const deltas: unknown[] = [];
  const ingestion = {
    ingestPage: jest.fn(async (_q: unknown, posts: unknown[], after?: (tx: unknown, r: unknown) => Promise<void>) => {
      const r = { inserted: posts.length, updated: 0, duplicated: 0, excluded: 0, enqueued: 0 };
      await after?.({}, r);
      return r;
    }),
  };
  const recorder = {
    start: jest.fn().mockResolvedValue({ id: "job1", windowSince: null, windowUntil: null, lastCursor: null }),
    recordPageTx: jest.fn(async (_tx: unknown, _id: string, d: unknown) => {
      deltas.push(d);
    }),
    recordFailedAttempts: jest.fn().mockResolvedValue(undefined),
    finish: jest.fn().mockResolvedValue(undefined),
  };
  const logger = { setContext: jest.fn(), info: jest.fn() };
  const svc = new CollectorService(
    prisma as unknown as PrismaService,
    cfg,
    provider,
    tokens,
    ingestion as unknown as IngestionService,
    recorder as unknown as SyncJobRecorder,
    logger as unknown as PinoLogger,
    { sleep: async () => undefined, random: () => 0 },
  );
  return { svc, prisma, search, recorder, deltas };
}

describe("CollectorService (T-052, doc 06 §5)", () => {
  it("FR-073 / TC-COL-007: follows cursors until none → success, watermark = window.until (BR-014)", async () => {
    const { svc, search, recorder, prisma, deltas } = setup([
      page([item("a", 1)], "c1"),
      page([item("b", 2)], "c2"),
      page([item("c", 3)]),
    ]);
    const out = await svc.run(claimed);
    expect(out.status).toBe("success");
    expect(search).toHaveBeenCalledTimes(3);
    expect(search.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      expect.not.objectContaining({ cursor: expect.anything() }),
      expect.objectContaining({ cursor: "c1" }),
      expect.objectContaining({ cursor: "c2" }),
    ]);
    expect(deltas).toHaveLength(3);
    expect(deltas[2]).toMatchObject({ lastCursor: null, fetched: 1, inserted: 1, providerRequests: 1 });
    expect(prisma.listeningQuery.updateMany).toHaveBeenCalledWith({
      where: { id: "q1", lockedBy: "w1" },
      data: { lastSuccessfulSyncAt: expect.any(Date) },
    });
    expect(recorder.finish).toHaveBeenCalledWith("job1", {
      status: "success",
      errorCode: undefined,
      errorMessage: undefined,
    });
  });

  it("TC-COL-008 / FR-087: page cap with more pages → partial, cursor kept, watermark unchanged", async () => {
    const { svc, search, recorder, prisma, deltas } = setup([page([item("a", 1)], "c1"), page([item("b", 2)], "c2")], {
      maxPages: 2,
    });
    const out = await svc.run(claimed);
    expect(out).toMatchObject({ status: "partial", errorMessage: "page cap reached (2)" });
    expect(out.errorCode).toBeUndefined();
    expect(search).toHaveBeenCalledTimes(2);
    expect(deltas[1]).toMatchObject({ lastCursor: "c2" });
    expect(prisma.listeningQuery.updateMany).not.toHaveBeenCalled();
    expect(recorder.finish).toHaveBeenCalledWith("job1", expect.objectContaining({ status: "partial" }));
  });

  it("BR-014 / TC-COL-024: failure on page 3 after 2 committed pages → partial, error code kept", async () => {
    const { svc, prisma } = setup([
      page([item("a", 1)], "c1"),
      page([item("b", 2)], "c2"),
      new ProviderError("THREADS_MALFORMED_RESPONSE", "bad"),
    ]);
    const out = await svc.run(claimed);
    expect(out).toMatchObject({ status: "partial", errorCode: "THREADS_MALFORMED_RESPONSE" });
    expect(prisma.listeningQuery.updateMany).not.toHaveBeenCalled();
  });

  it("FR-087: failure on page 1 → failed, failed attempts still recorded", async () => {
    const { svc, recorder } = setup([new ProviderError("THREADS_UNAUTHORIZED", "expired")]);
    const out = await svc.run(claimed);
    expect(out).toMatchObject({ status: "failed", errorCode: "THREADS_UNAUTHORIZED" });
    expect(recorder.recordFailedAttempts).toHaveBeenCalledWith("job1", 1, 0);
  });

  it("FR-089: 429 retry counts rate_limit_events and every attempt in provider_requests", async () => {
    const { svc, deltas } = setup([
      new ProviderError("THREADS_RATE_LIMITED", "slow down", { retryAfterMs: 1 }),
      page([item("a", 1)]),
    ]);
    expect((await svc.run(claimed)).status).toBe("success");
    expect(deltas[0]).toMatchObject({ providerRequests: 2, rateLimitEvents: 1 });
  });

  it("TC-COL-026: provider_usage snapshot drops sensitive headers", async () => {
    const { svc, deltas } = setup([page([item("a", 1)])]);
    await svc.run(claimed);
    expect(deltas[0]).toMatchObject({
      providerUsage: { remaining: 10, resetAt: expect.any(String), raw: { "x-app-usage": "1" } },
    });
    expect(JSON.stringify(deltas[0])).not.toContain("authorization");
  });

  it("doc 06 §5: RECENT stops once a page reaches past `since`; TOP keeps paging", async () => {
    const old = (3 * 86_400_000) / 60_000; // older than the 1-day first-run window
    const recent = setup([page([item("a", 1), item("old", old)], "c1"), page([item("b", 2)])]);
    expect((await recent.svc.run(claimed)).status).toBe("success");
    expect(recent.search).toHaveBeenCalledTimes(1);

    const top = setup([page([item("a", 1), item("old", old)], "c1"), page([item("b", 2)])], { searchType: "TOP" });
    await top.svc.run(claimed);
    expect(top.search).toHaveBeenCalledTimes(2);
  });

  it("aborted signal stops between pages (partial after one page)", async () => {
    const ctrl = new AbortController();
    const { svc, search } = setup([page([item("a", 1)], "c1"), page([item("b", 2)])]);
    search.mockImplementationOnce(async () => {
      ctrl.abort();
      return page([item("a", 1)], "c1");
    });
    const out = await svc.run(claimed, ctrl.signal);
    expect(out).toMatchObject({ status: "partial", errorCode: "INTERNAL" });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("resumes from the queued job's last_cursor (retry, TC-COL-008)", async () => {
    const { svc, search, recorder } = setup([page([item("c", 3)])]);
    recorder.start.mockResolvedValueOnce({ id: "job2", windowSince: null, windowUntil: null, lastCursor: "c2" });
    await svc.run({ ...claimed, manualJobId: "job2" });
    expect(search.mock.calls[0]).toEqual([expect.objectContaining({ cursor: "c2" }), expect.anything()]);
    expect(recorder.start).toHaveBeenCalledWith(expect.objectContaining({ queuedJobId: "job2", workerId: "w1" }));
  });
});
