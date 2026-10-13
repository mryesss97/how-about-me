import type { ReviewQueueItem, ReviewReason, UserRef } from "@how-about-me/contracts";
import { confidenceBand } from "@how-about-me/taxonomy";
import type { OverrideUser } from "./overrides.repository";
import type { ReviewQueueRow } from "./review-queue.repository";

/** Fixed display order (REVIEW_REASONS): failed, uncertain, low_confidence. */
export function reasonsOf(row: Pick<ReviewQueueRow, "is_failed" | "is_uncertain" | "is_low">): ReviewReason[] {
  const out: ReviewReason[] = [];
  if (row.is_failed) out.push("failed");
  if (row.is_uncertain) out.push("uncertain");
  if (row.is_low) out.push("low_confidence");
  return out;
}

function userRef(id: string | null, users: Map<string, OverrideUser>): UserRef | null {
  if (!id) return null;
  const u = users.get(id);
  return u ? { id: u.id, displayName: u.displayName, email: u.email } : null;
}

/**
 * Queue row → DTO (FR-195). Band uses the bands of the run's policy (doc 08 §8, BR-021), same thresholds as the
 * `low_confidence` reason; it is an estimate, not a probability (BR-020). `errorCode` only when failed.
 */
export function toReviewQueueItem(row: ReviewQueueRow, users: Map<string, OverrideUser>): ReviewQueueItem {
  const status = row.latest_run_status ?? "pending";
  const overall = row.overall_model_confidence;
  return {
    id: row.post_id,
    platform: row.platform,
    platformPostId: row.platform_post_id,
    username: row.username,
    permalink: row.permalink,
    publishedAt: row.published_at.toISOString(),
    text: row.text,
    reasons: reasonsOf(row),
    analysis: {
      status,
      relevance: row.relevance_label,
      sentiment: row.sentiment_label,
      overallConfidence: overall,
      confidenceBand:
        overall == null ? null : confidenceBand(overall, { high: row.high_band, medium: row.medium_band }),
      errorCode: status === "failed" ? row.error_code : null,
      hasOverride: row.has_override,
    },
    reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
    reviewedBy: userRef(row.reviewed_by, users),
  };
}
