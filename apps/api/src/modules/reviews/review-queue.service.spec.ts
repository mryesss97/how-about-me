import { ReviewQueueQuerySchema } from "@how-about-me/contracts";
import type { Prisma } from "@prisma/client";
import type { PinoLogger } from "nestjs-pino";
import { encodeSortCursor } from "../../common/pagination/cursor";
import type { AuditService } from "../audit/audit.service";
import type { OverridesRepository } from "./overrides.repository";
import type { ReviewQueueRepository, ReviewQueueRow } from "./review-queue.repository";
import { ReviewQueueService } from "./review-queue.service";

const PID = "00000000-0000-7000-8000-000000000001";
const ACTOR = "00000000-0000-7000-8000-000000000003";
const id = (i: number) => `00000000-0000-7000-8000-${String(i).padStart(12, "0")}`;

const row = (i: number): ReviewQueueRow => ({
  post_id: id(100 + i),
  platform: "threads",
  platform_post_id: String(i),
  username: null,
  permalink: null,
  published_at: new Date("2026-10-12T03:00:00Z"),
  text: null,
  latest_run_status: "failed",
  relevance_label: null,
  sentiment_label: null,
  overall_model_confidence: null,
  has_override: false,
  error_code: "X",
  medium_band: 0.6,
  high_band: 0.8,
  is_uncertain: false,
  is_low: false,
  is_failed: true,
  reviewed_at: null,
  reviewed_by: null,
  k0: `2026-10-12T03:00:00.00000${i % 10}Z`,
});

function setup(rows: ReviewQueueRow[] = [], marked: string[] = []) {
  const tx = {} as Prisma.TransactionClient;
  const repo = {
    transaction: jest.fn((fn: (t: Prisma.TransactionClient) => Promise<unknown>) => fn(tx)),
    listPage: jest.fn().mockResolvedValue(rows),
    counts: jest.fn().mockResolvedValue({ all: 3, uncertain: 1, lowConfidence: 1, failed: 2 }),
    markReviewed: jest.fn().mockResolvedValue(marked),
  };
  const users = { usersById: jest.fn().mockResolvedValue(new Map()) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const svc = new ReviewQueueService(
    repo as unknown as ReviewQueueRepository,
    users as unknown as OverridesRepository,
    audit as unknown as AuditService,
    { warn: jest.fn() } as unknown as PinoLogger,
  );
  return { svc, repo, audit, tx };
}

// T-144, FR-195
describe("ReviewQueueService.list", () => {
  it("tampered or other-sort cursor → VALIDATION_ERROR path=cursor", async () => {
    const { svc } = setup();
    const bad = [
      "!!!",
      encodeSortCursor({ sort: "newest", keys: ["2026-10-12T03:00:00.000000Z"], id: id(1) }),
      encodeSortCursor({ sort: "review_newest", keys: ["yesterday"], id: id(1) }),
    ];
    for (const cursor of bad) {
      await expect(svc.list(PID, ReviewQueueQuerySchema.parse({ cursor }))).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        details: { path: "cursor" },
      });
    }
  });

  it("nextCursor when limit+1 rows; count=false does not call counts", async () => {
    const { svc, repo } = setup([row(1), row(2), row(3)]);
    const page = await svc.list(PID, ReviewQueueQuerySchema.parse({ limit: "2" }));
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe(encodeSortCursor({ sort: "review_newest", keys: [row(2).k0], id: row(2).post_id }));
    expect(page).not.toHaveProperty("counts");
    expect(repo.counts).not.toHaveBeenCalled();
  });

  it("count=true → counts + totalCount of the requested tab", async () => {
    const { svc, repo } = setup([row(1)]);
    const page = await svc.list(PID, ReviewQueueQuerySchema.parse({ count: "true", reason: "failed" }));
    expect(repo.counts).toHaveBeenCalledWith(PID, "unreviewed");
    expect(page).toMatchObject({ nextCursor: null, totalCount: 2, counts: { all: 3, failed: 2 } });
  });

  it("count timeout → counts omitted", async () => {
    const { svc, repo } = setup([]);
    repo.counts.mockResolvedValue(null);
    const page = await svc.list(PID, ReviewQueueQuerySchema.parse({ count: "true" }));
    expect(page).toEqual({ items: [], nextCursor: null });
  });
});

describe("ReviewQueueService.markReviewed", () => {
  it("audits review.marked with { count, postIds } of updated rows", async () => {
    const { svc, repo, audit, tx } = setup([], [id(1)]);
    const res = await svc.markReviewed(PID, { postIds: [id(1), id(1), id(2)] }, ACTOR, "req-1");
    expect(res).toEqual({ marked: 1 });
    expect(repo.markReviewed).toHaveBeenCalledWith(tx, PID, [id(1), id(2)], ACTOR);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "review.marked",
        entityType: "monitoring_project",
        entityId: PID,
        metadata: { count: 1, postIds: [id(1)] },
        requestId: "req-1",
      }),
      tx,
    );
  });

  it("marked=0 → no audit", async () => {
    const { svc, audit } = setup([], []);
    expect(await svc.markReviewed(PID, { postIds: [id(9)] }, ACTOR, null)).toEqual({ marked: 0 });
    expect(audit.record).not.toHaveBeenCalled();
  });
});
