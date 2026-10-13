import type { Prisma } from "@prisma/client";
import type { PinoLogger } from "nestjs-pino";
import { encodeSortCursor } from "../../common/pagination/cursor";
import type { MentionPageRow } from "./mentions.repository";
import type { AnalysisService } from "../analysis/analysis.service";
import type { AuditService } from "../audit/audit.service";
import type { MentionForReanalyze, MentionsRepository } from "./mentions.repository";
import { MentionsService } from "./mentions.service";

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
    effectiveVersion: "v1",
    enqueueDetailed: jest
      .fn()
      .mockResolvedValue(
        opts.created === false ? { created: false, reason: "already_open" } : { created: true, runId: RUN },
      ),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const svc = new MentionsService(
    repo as unknown as MentionsRepository,
    analysis as unknown as AnalysisService,
    audit as unknown as AuditService,
    { warn: jest.fn() } as unknown as PinoLogger,
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
  keys: [`2026-10-01 00:00:0${i}+00`],
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
