"use client";

import type { ReviewQueueCounts, ReviewReason } from "@how-about-me/contracts";
import { ToggleButton as AriaToggleButton, ToggleButtonGroup as AriaToggleButtonGroup } from "react-aria-components";
import { formatCount } from "@/lib/format/number";
import { reviewReasonLabelVi } from "@/lib/semantics/labels";

const TABS: { id: "all" | ReviewReason; label: string; count: keyof ReviewQueueCounts }[] = [
  { id: "all", label: "Tất cả", count: "all" },
  { id: "uncertain", label: reviewReasonLabelVi.uncertain, count: "uncertain" },
  { id: "low_confidence", label: reviewReasonLabelVi.low_confidence, count: "lowConfidence" },
  { id: "failed", label: reviewReasonLabelVi.failed, count: "failed" },
];

/**
 * Reason filter (FR-195) as signboard plaques (#278): `.plaque-button` inverts on `[data-selected]`.
 * A single-select toggle group (radiogroup), not tabs: it filters one list, there are no tab panels (#352).
 * Counts hidden when `counts` is absent (count timed out) — never a fake 0 (BR-032).
 */
export function ReviewTabs({
  reason,
  counts,
  onChange,
}: {
  reason: ReviewReason | undefined;
  counts: ReviewQueueCounts | undefined;
  onChange: (reason: ReviewReason | null) => void;
}) {
  return (
    <AriaToggleButtonGroup
      aria-label="Lý do cần xem lại"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[reason ?? "all"]}
      onSelectionChange={(keys) => {
        const k = [...keys][0];
        onChange(k === undefined || k === "all" ? null : (String(k) as ReviewReason));
      }}
      className="flex flex-wrap gap-2"
    >
      {TABS.map((t) => (
        <AriaToggleButton
          key={t.id}
          id={t.id}
          className="plaque-button min-h-11 cursor-pointer px-3 py-1.5 md:min-h-0 outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {t.label}
          {counts ? <span className="tabular-nums"> · {formatCount(counts[t.count])}</span> : null}
        </AriaToggleButton>
      ))}
    </AriaToggleButtonGroup>
  );
}
