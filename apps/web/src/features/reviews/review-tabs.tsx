"use client";

import type { ReviewQueueCounts, ReviewReason } from "@how-about-me/contracts";
import { Tab as AriaTab, TabList as AriaTabList, Tabs as AriaTabs } from "react-aria-components";
import { formatCount } from "@/lib/format/number";
import { reviewReasonLabelVi } from "@/lib/semantics/labels";

const TABS: { id: "all" | ReviewReason; label: string; count: keyof ReviewQueueCounts }[] = [
  { id: "all", label: "Tất cả", count: "all" },
  { id: "uncertain", label: reviewReasonLabelVi.uncertain, count: "uncertain" },
  { id: "low_confidence", label: reviewReasonLabelVi.low_confidence, count: "lowConfidence" },
  { id: "failed", label: reviewReasonLabelVi.failed, count: "failed" },
];

/**
 * Tabs by review reason (FR-195) as signboard plaques (#278): `.plaque-button` inverts on `[data-selected]`.
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
    <AriaTabs
      selectedKey={reason ?? "all"}
      onSelectionChange={(k) => onChange(k === "all" ? null : (String(k) as ReviewReason))}
    >
      <AriaTabList aria-label="Lý do cần xem lại" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <AriaTab
            key={t.id}
            id={t.id}
            className="plaque-button cursor-pointer px-3 py-1.5 outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {t.label}
            {counts ? <span className="tabular-nums"> · {formatCount(counts[t.count])}</span> : null}
          </AriaTab>
        ))}
      </AriaTabList>
    </AriaTabs>
  );
}
