"use client";

import type { ReviewQueueItem } from "@how-about-me/contracts";
import type { ConfidenceBand } from "@how-about-me/taxonomy";
import { Badge } from "@/components/base/badges/badges";
import { formatRate } from "@/lib/format/number";
import { reviewReasonLabelVi } from "@/lib/semantics/labels";

export const BAND_LABEL: Record<ConfidenceBand, string> = { low: "Thấp", medium: "Trung bình", high: "Cao" };

/** Reason plates — always labelled, colour never alone (UX §2.2). */
export function ReasonBadges({ reasons }: { reasons: ReviewQueueItem["reasons"] }) {
  return (
    <>
      {reasons.map((r) => (
        <Badge key={r} type="pill-color" color={r === "failed" ? "error" : "warning"} size="sm">
          {reviewReasonLabelVi[r]}
        </Badge>
      ))}
    </>
  );
}

/** Confidence value + band (BR-020: an estimate for prioritisation, not a probability). */
export function ConfidenceCell({ analysis }: { analysis: ReviewQueueItem["analysis"] }) {
  return (
    <span className="whitespace-nowrap">
      <span title="Độ tin cậy ước tính — là mức để ưu tiên, không phải xác suất">
        {formatRate(analysis.overallConfidence)}
      </span>
      {analysis.confidenceBand ? (
        <Badge type="modern" color="gray" size="sm" className="ml-1">
          {BAND_LABEL[analysis.confidenceBand]}
        </Badge>
      ) : null}
    </span>
  );
}
