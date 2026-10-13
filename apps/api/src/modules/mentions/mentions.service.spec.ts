import type { Prisma } from "@prisma/client";
import type { PinoLogger } from "nestjs-pino";
import { encodeSortCursor } from "../../common/pagination/cursor";
import type { MentionPageRow } from "./mentions.repository";
import type { AnalysisService } from "../analysis/analysis.service";
import type { AuditService } from "../audit/audit.service";
import type { MentionForReanalyze, MentionsRepository } from "./mentions.repository";
import { MentionsService } from "./mentions.service";
import type { AppConfig } from "../../config/config.module";
import type { BulkReanalyzeThrottle } from "../analysis/bulk-reanalyze-throttle";
import type { OverridesRepository } from "../reviews/overrides.repository";

const PID = "00000000-0000-7000-8000-000000000001";
const MID = "00000000-0000-7000-8000-000000000002";
const ACTOR = "00000000-0000-7000-8000-000000000003";
const RUN = "00000000-0000-7000-8000-000000000004";
const post: MentionForReanalyze = { id: MID, projectId: PID, contentHash: "h1", revision: 1 };

function setup(opts: { post?: MentionForReanalyze | null; open?: boolean; created?: boolean }) {
  const tx = {} as Prisma.TransactionClient;
  const repo = {
    findInProject: jest.fn().mockResolvedValue(opts.post === undefined ? post : opts.post),
    hasOpenRun: jest.fn().mockResolvedValue(opts.open ?? false),
    transaction: jest.fn((fn: (t: Prisma.TransactionClient) => Promise<unknown>) => fn(tx)),
  };
  const analysis = {
    enqueueDetailed: jest
      .fn()
      .mockResolvedValue(
        opts.created === false
          ? { created: false, reason: "already_open" }
          : { created: true, runId: RUN, effectiveVersion: "v1" },
      ),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const svc = new MentionsService(
    repo as unknown as MentionsRepository,
    analysis as unknown as AnalysisService,
    audit as unknown as AuditService,
    { warn: jest.fn() } as unknown as PinoLogger,
    { assertAllowed: jest.fn() } as unknown as BulkReanalyzeThrottle,
    { ANALYSIS_BULK_MAX: 2000 } as AppConfig,
    {} as OverridesRepository,
  );
  return { svc, repo, analysis, audit, tx };
}

/** FR-115 / FR-116 / BR-024 — POST …/mentions/:mentionId/reanalyze (T-076). */
describe("MentionsService.reanalyze", () => {
  it("TC-ANA-018: enqueues a manual (force) run and audits it in the same tx", async () => {
    const { svc, analysis, audit, tx } = setup({});
    await expect(svc.reanalyze(PID, MID, ACTOR, "req-1")).resolves.toEqual({ runId: RUN, status: "pending" });
    expect(analysis.enqueueDetailed).toHaveBeenCalledWith(tx, {
      postId: MID,
      projectId: PID,
      contentHash: "h1",
      revision: 1,
      trigger: "manual",
      requestedBy: ACTOR,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "analysis.reanalyze_requested",
        entityId: MID,
        metadata: { runId: RUN, effectiveVersion: "v1" },
        requestId: "req-1",
      }),
      tx,
    );
  });

  it("404 when the mention is not in the project", async () => {
    const { svc, analysis } = setup({ post: null });
    await expect(svc.reanalyze(PID, MID, ACTOR, null)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(analysis.enqueueDetailed).not.toHaveBeenCalled();
  });

  it("TC-ANA-019: 409 when the post already has an open run", async () => {
    const { svc, analysis, audit } = setup({ open: true });
    await expect(svc.reanalyze(PID, MID, ACTOR, null)).rejects.toMatchObject({ code: "ANALYSIS_ALREADY_PENDING" });
    expect(analysis.enqueueDetailed).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("BR-024: a request that loses the race on the partial unique index gets 409, not 500", async () => {
    const { svc, audit } = setup({ created: false });
    await expect(svc.reanalyze(PID, MID, ACTOR, null)).rejects.toMatchObject({ code: "ANALYSIS_ALREADY_PENDING" });
    expect(audit.record).not.toHaveBeenCalled();
  });
});

const row = (i: number): MentionPageRow => ({
  post_id: `00000000-0000-7000-8000-0000000001${String(i).padStart(2, "0")}`,
  platform: "threads",
  platform_post_id: `tp-${i}`,
  username: null,
  permalink: null,
  published_at: new Date("2026-10-01T00:00:00Z"),
  text: "t",
  media_type: null,
  thumbnail_url: null,
  has_replies: null,
  is_quote_post: null,
  latest_run_status: "completed",
  analysis_id: null,
  relevance_label: "relevant",
  relevance_confidence: 0.9,
  sentiment_label: "neutral",
  sentiment_confidence: 0.9,
  safety_level: "safe",
  language_code: "vi",
  summary: null,
  overall_model_confidence: 0.9,
  has_override: false,
  high_band: 0.8,
  medium_band: 0.6,
  keys: [`2026-10-01T00:00:0${i}.000000Z`],
});

function listSetup(rows: MentionPageRow[], count: number | null = 7) {
  const repo = {
    listPage: jest.fn().mockResolvedValue(rows),
    count: jest.fn().mockResolvedValue(count),
    hydrate: jest
      .fn()
      .mockResolvedValue({ matches: new Map(), intents: new Map(), topics: new Map(), errorCodes: new Map() }),
  };
  const logger = { warn: jest.fn() };
  const svc = new MentionsService(
    repo as unknown as MentionsRepository,
    {} as AnalysisService,
    {} as AuditService,
    logger as unknown as PinoLogger,
    {} as BulkReanalyzeThrottle,
    {} as AppConfig,
    {} as OverridesRepository,
  );
  return { svc, repo, logger };
}

const LQ = (over: Record<string, unknown> = {}) =>
  ({
    queryIds: [],
    relevance: ["relevant"],
    sentiment: [],
    safety: [],
    language: [],
    analysisStatus: [],
    intent: [],
    topic: [],
    timeField: "published_at",
    reviewStatus: [],
    sort: "newest",
    limit: 2,
    count: false,
    ...over,
  }) as unknown as Parameters<MentionsService["list"]>[1];

/** FR-150/152/153 — GET …/mentions (T-095). */
describe("MentionsService.list", () => {
  it("TC-MEN-003: limit+1 rows → nextCursor; fewer → null", async () => {
    const a = listSetup([row(1), row(2), row(3)]);
    const page = await a.svc.list(PID, LQ());
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe(encodeSortCursor({ sort: "newest", keys: row(2).keys, id: row(2).post_id }));
    const b = listSetup([row(1)]);
    expect((await b.svc.list(PID, LQ())).nextCursor).toBeNull();
  });

  it("count=false never runs the count query", async () => {
    const { svc, repo } = listSetup([row(1)]);
    const page = await svc.list(PID, LQ());
    expect(repo.count).not.toHaveBeenCalled();
    expect(page).not.toHaveProperty("totalCount");
  });

  it("count=true attaches totalCount; timeout (null) omits it and logs warn without q", async () => {
    const ok = listSetup([row(1)], 7);
    expect((await ok.svc.list(PID, LQ({ count: true }))).totalCount).toBe(7);
    const slow = listSetup([row(1)], null);
    const page = await slow.svc.list(PID, LQ({ count: true, q: "secret term" }));
    expect(page).not.toHaveProperty("totalCount");
    expect(slow.logger.warn).toHaveBeenCalledWith(
      { projectId: PID, event: "mentions.count_timeout" },
      expect.any(String),
    );
  });

  it("TC-MEN-004: a cursor from another sort → VALIDATION_ERROR", async () => {
    const { svc, repo } = listSetup([]);
    const cursor = encodeSortCursor({ sort: "newest", keys: ["x"], id: MID });
    await expect(svc.list(PID, LQ({ sort: "oldest", cursor }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(repo.listPage).not.toHaveBeenCalled();
  });
});

describe("MentionsService.list tampered keys (#195)", () => {
  it("a cursor with a non-timestamp key → VALIDATION_ERROR, repo untouched", async () => {
    const { svc, repo } = listSetup([]);
    const cursor = encodeSortCursor({ sort: "newest", keys: ["abc"], id: MID });
    await expect(svc.list(PID, LQ({ cursor }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(repo.listPage).not.toHaveBeenCalled();
  });
});

/** T-096 — FR-154: GET …/mentions/:mentionId. */
describe("MentionsService.detail", () => {
  const mk = (row: unknown) => {
    const repo = {
      findDetail: jest.fn().mockResolvedValue(row),
      hydrate: jest
        .fn()
        .mockResolvedValue({ matches: new Map(), intents: new Map(), topics: new Map(), errorCodes: new Map() }),
      listRuns: jest.fn().mockResolvedValue([]),
    };
    const overrides = { listForPost: jest.fn().mockResolvedValue([]) };
    const svc = new MentionsService(
      repo as unknown as MentionsRepository,
      {} as AnalysisService,
      {} as AuditService,
      { warn: jest.fn() } as unknown as PinoLogger,
      {} as BulkReanalyzeThrottle,
      {} as AppConfig,
      overrides as unknown as OverridesRepository,
    );
    return { svc, repo, overrides };
  };

  it("not found / other project → AppError NOT_FOUND", async () => {
    const { svc } = mk(null);
    await expect(svc.detail(PID, MID)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("unanalysed post → hydrate by post id, runs and override history (FR-193)", async () => {
    const row = {
      post_id: MID,
      analysis_id: null,
      published_at: new Date(),
      first_seen_at: new Date(),
      last_seen_at: new Date(),
      analyzed_at: null,
      safety_category_scores: null,
      has_override: false,
      high_band: 0.8,
      medium_band: 0.6,
      latest_run_status: null,
    };
    const { svc, repo, overrides } = mk(row);
    await svc.detail(PID, MID);
    expect(repo.hydrate).toHaveBeenCalledWith([MID]);
    expect(overrides.listForPost).toHaveBeenCalledWith(MID);
    expect(repo.listRuns).toHaveBeenCalledWith(MID);
  });
});

/** FR-196 / NFR-017 / BR-024 — POST …/mentions/reanalyze (T-145). */
describe("MentionsService.bulkReanalyze", () => {
  const NOW = new Date("2026-10-13T00:00:00Z");
  function bulkSetup(throttleError?: Error) {
    const tx = {} as Prisma.TransactionClient;
    const repo = {
      countMatched: jest.fn().mockResolvedValue(5),
      selectBulkCandidates: jest.fn().mockResolvedValue([post]),
      transaction: jest.fn((fn: (t: Prisma.TransactionClient) => Promise<unknown>) => fn(tx)),
    };
    const analysis = {
      effectiveVersionFor: jest.fn().mockResolvedValue("v2"),
      enqueueMany: jest.fn().mockResolvedValue({ postIds: [MID], effectiveVersion: "v2" }),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const throttle = {
      assertAllowed: throttleError ? jest.fn().mockRejectedValue(throttleError) : jest.fn(),
    };
    const svc = new MentionsService(
      repo as unknown as MentionsRepository,
      analysis as unknown as AnalysisService,
      audit as unknown as AuditService,
      { warn: jest.fn() } as unknown as PinoLogger,
      throttle as unknown as BulkReanalyzeThrottle,
      { ANALYSIS_BULK_MAX: 3 } as AppConfig,
      {} as OverridesRepository,
    );
    return { svc, repo, analysis, audit, throttle, tx };
  }
  const body = {
    dryRun: false,
    sort: "newest" as const,
    relevance: ["relevant" as const],
    q: "abc",
  } as unknown as Parameters<MentionsService["bulkReanalyze"]>[1];

  it("TC-REV-008: dryRun counts only — no throttle, enqueue or audit", async () => {
    const { svc, repo, analysis, audit, throttle } = bulkSetup();
    await expect(svc.bulkReanalyze(PID, { ...body, dryRun: true }, ACTOR, null, NOW)).resolves.toEqual({
      matched: 5,
      enqueued: 0,
      cap: 3,
    });
    expect(repo.transaction).not.toHaveBeenCalled();
    expect(throttle.assertAllowed).not.toHaveBeenCalled();
    expect(analysis.enqueueMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("TC-REV-009 / BR-024: cap is the candidate limit, trigger=bulk, audit has filters but no post ids", async () => {
    const { svc, repo, analysis, audit, tx } = bulkSetup();
    await expect(svc.bulkReanalyze(PID, body, ACTOR, "req-1", NOW)).resolves.toEqual({
      matched: 5,
      enqueued: 1,
      cap: 3,
    });
    expect(repo.selectBulkCandidates).toHaveBeenCalledWith(tx, expect.anything(), "abc", "newest", "v2", 3);
    expect(analysis.enqueueMany).toHaveBeenCalledWith(tx, expect.objectContaining({ trigger: "bulk" }));
    const meta = (audit.record.mock.calls[0]?.[0] as { metadata: Record<string, unknown> }).metadata;
    expect(meta).toMatchObject({
      scope: "filters",
      counts: { matched: 5, enqueued: 1, cap: 3 },
      effectiveVersion: "v2",
    });
    expect(JSON.stringify(meta)).not.toContain(MID);
    expect(meta.filters).not.toHaveProperty("dryRun");
  });

  it("NFR-017: throttle error propagates and nothing is enqueued", async () => {
    const { svc, analysis, audit } = bulkSetup(new Error("429"));
    await expect(svc.bulkReanalyze(PID, body, ACTOR, null, NOW)).rejects.toThrow("429");
    expect(analysis.enqueueMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
