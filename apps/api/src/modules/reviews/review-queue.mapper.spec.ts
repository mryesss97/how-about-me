import { reasonsOf, toMentionReviewState, toReviewQueueItem } from "./review-queue.mapper";
import type { ReviewQueueRow } from "./review-queue.repository";

const PID = "00000000-0000-7000-8000-000000000001";
const UID = "00000000-0000-7000-8000-000000000003";

const row = (over: Partial<ReviewQueueRow> = {}): ReviewQueueRow => ({
  post_id: PID,
  platform: "threads",
  platform_post_id: "1",
  username: "u",
  permalink: null,
  published_at: new Date("2026-10-12T03:00:00Z"),
  text: "<b>hi</b>",
  latest_run_status: "completed",
  relevance_label: "relevant",
  sentiment_label: "neutral",
  overall_model_confidence: 0.65,
  has_override: false,
  error_code: "OLD_ERROR",
  medium_band: 0.6,
  high_band: 0.8,
  is_uncertain: false,
  is_low: false,
  is_failed: false,
  reviewed_at: null,
  reviewed_by: null,
  k0: "2026-10-12T03:00:00.000000Z",
  ...over,
});

// FR-195 / T-144
describe("review queue mapper", () => {
  it("reasons in fixed order: failed, uncertain, low_confidence", () => {
    expect(reasonsOf({ is_low: true, is_uncertain: true, is_failed: true })).toEqual([
      "failed",
      "uncertain",
      "low_confidence",
    ]);
    expect(reasonsOf({ is_low: true, is_uncertain: false, is_failed: false })).toEqual(["low_confidence"]);
  });

  it("BR-021: band uses the run's policy bands, not v1", () => {
    expect(toReviewQueueItem(row(), new Map()).analysis.confidenceBand).toBe("medium");
    expect(toReviewQueueItem(row({ medium_band: 0.7 }), new Map()).analysis.confidenceBand).toBe("low");
    expect(toReviewQueueItem(row({ overall_model_confidence: null }), new Map()).analysis.confidenceBand).toBeNull();
  });

  it("errorCode only when failed; pending when no run", () => {
    expect(toReviewQueueItem(row(), new Map()).analysis.errorCode).toBeNull();
    const failed = toReviewQueueItem(row({ latest_run_status: "failed", is_failed: true }), new Map());
    expect(failed.analysis).toMatchObject({ status: "failed", errorCode: "OLD_ERROR" });
    expect(toReviewQueueItem(row({ latest_run_status: null }), new Map()).analysis.status).toBe("pending");
  });

  it("reviewedBy resolves user; null when user is gone; timestamps ISO UTC", () => {
    const at = new Date("2026-10-13T01:02:03Z");
    const users = new Map([[UID, { id: UID, displayName: "An", email: "a@x.io" }]]);
    const item = toReviewQueueItem(row({ reviewed_at: at, reviewed_by: UID }), users);
    expect(item.reviewedAt).toBe("2026-10-13T01:02:03.000Z");
    expect(item.reviewedBy).toEqual({ id: UID, displayName: "An", email: "a@x.io" });
    expect(toReviewQueueItem(row({ reviewed_at: at, reviewed_by: UID }), new Map()).reviewedBy).toBeNull();
    expect(item.publishedAt).toBe("2026-10-12T03:00:00.000Z");
  });
});

// #339, FR-195, BR-040: review state on mention detail.
describe("toMentionReviewState", () => {
  const st = { is_uncertain: false, is_low: false, is_failed: false, is_reviewed: false, reviewed_at: null };
  it("no row or no reason → null", () => {
    expect(toMentionReviewState(null)).toBeNull();
    expect(toMentionReviewState(st)).toBeNull();
  });
  it("reasons in fixed order; status follows is_reviewed (BR-040)", () => {
    const at = new Date("2026-10-12T03:00:00Z");
    expect(toMentionReviewState({ ...st, is_low: true, is_failed: true, is_uncertain: true })).toEqual({
      reasons: ["failed", "uncertain", "low_confidence"],
      status: "unreviewed",
      reviewedAt: null,
    });
    expect(toMentionReviewState({ ...st, is_low: true, is_reviewed: true, reviewed_at: at })).toEqual({
      reasons: ["low_confidence"],
      status: "reviewed",
      reviewedAt: at.toISOString(),
    });
  });
});
