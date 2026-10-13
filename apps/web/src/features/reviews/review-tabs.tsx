"use client";

import type { ReviewQueueCounts, ReviewReason } from "@how-about-me/contracts";
import { Tabs } from "@/components/application/tabs/tabs";
import { formatCount } from "@/lib/format/number";

const TABS: { id: "all" | ReviewReason; label: string; count: keyof ReviewQueueCounts }[] = [
  { id: "all", label: "All", count: "all" },
  { id: "uncertain", label: "Uncertain", count: "uncertain" },
  { id: "low_confidence", label: "Low confidence", count: "lowConfidence" },
  { id: "failed", label: "Failed", count: "failed" },
];

/** Tabs by review reason (FR-195). Badges hidden when `counts` is absent (count timed out) — never a fake 0. */
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
    <Tabs
      selectedKey={reason ?? "all"}
      onSelectionChange={(k) => onChange(k === "all" ? null : (String(k) as ReviewReason))}
    >
      <Tabs.List type="underline" aria-label="Review reason">
        {TABS.map((t) => (
          <Tabs.Item key={t.id} id={t.id} label={t.label} badge={counts ? formatCount(counts[t.count]) : undefined} />
        ))}
      </Tabs.List>
    </Tabs>
  );
}
