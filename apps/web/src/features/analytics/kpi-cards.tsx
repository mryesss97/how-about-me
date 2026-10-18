"use client";

import type { OverviewResponse } from "@how-about-me/contracts";
import type { DrillKpiId } from "@/lib/filters/drill-down";
import type { Filters } from "@/lib/filters/schema";
import { formatCount, formatGrowth, formatRate, formatRateDelta } from "@/lib/format/number";
import { safetyBadge, sentimentBadge } from "@/lib/semantics/badges";
import { displayLabel } from "@/lib/semantics/labels";
import { KpiCard } from "./kpi-card";
import { type KpiId, kpiDefinition } from "./kpi-definitions";

type Rate = OverviewResponse["kpis"]["positiveRate"];

function rateProps(id: KpiId, rate: Rate) {
  return {
    value: formatRate(rate.value),
    // Only present when compare=true (doc 07 §2); otherwise no delta.
    delta: formatRateDelta(rate.value, rate.previous),
    // Each rate names its own denominator (doc 07 §1.3–1.6, #335).
    subText: `trên ${formatCount(rate.denominator)} ${kpiDefinition(id).denominatorNoun ?? ""}`.trimEnd(),
  };
}

type PinFilters = Partial<Pick<Filters, "sentiment" | "safety" | "intent">>;

/** "Cảm xúc: Tiêu cực, Trung tính" when the global filter pins that dimension; any non-empty value counts (#335). */
function pinned(filters: PinFilters | undefined) {
  const join = (dim: string, labels: string[]) => (labels.length ? `${dim}: ${labels.join(", ")}` : undefined);
  return {
    sentiment: join(
      "Cảm xúc",
      (filters?.sentiment ?? []).map((k) => sentimentBadge[k].label),
    ),
    safety: join(
      "Mức an toàn",
      (filters?.safety ?? []).map((k) => safetyBadge[k].label),
    ),
    intent: join(
      "Ý định",
      (filters?.intent ?? []).map((k) => displayLabel("intent", k)),
    ),
  };
}

// #335: three groups of two (volume │ sentiment │ action); 2 columns on mobile, one row of six at xl.
const GROUPS = "isolate grid grid-cols-1 gap-8 xl:grid-cols-3";
const GROUP = "grid grid-cols-2 gap-4";

/** FR-132: six KPI cards for /overview. */
export function KpiCards({
  kpis,
  hrefFor,
  filters,
}: {
  kpis: OverviewResponse["kpis"];
  /** FR-142: drill-down href per KPI ("severe" = the "N severe" line). */
  hrefFor?: (id: DrillKpiId) => string;
  /** Active global filters; a pinned dimension switches its cards to the "Đang lọc theo …" state (#335). */
  filters?: PinFilters;
}) {
  const m = kpis.mentionCount;
  const severe = kpis.safetyRiskRate.severeCount;
  const pin = pinned(filters);
  return (
    <div className={GROUPS}>
      <div role="group" aria-label="Bao nhiêu" className={GROUP}>
        <KpiCard
          id="mentions"
          href={hrefFor?.("mentions")}
          value={formatCount(m.value)}
          subText="bài nhắc (không trùng)"
        />
        {/* No arrow on growth: the sign is in the figure (#335). */}
        <KpiCard
          id="growth"
          href={hrefFor?.("growth")}
          value={m.growthState === "new" ? "Mới" : formatGrowth(m.growthPct, m.growthState)}
          subText={m.previous == null ? undefined : `so với kỳ trước (${formatCount(m.previous)})`}
        />
      </div>
      <div role="group" aria-label="Cảm thấy thế nào" className={GROUP}>
        <KpiCard
          id="positive"
          tone="positive"
          filteredBy={pin.sentiment}
          href={hrefFor?.("positive")}
          {...rateProps("positive", kpis.positiveRate)}
        />
        {/* BR-017: only sentiment cards are tinted; the safety card stays ink. */}
        <KpiCard
          id="negative"
          tone="negative"
          filteredBy={pin.sentiment}
          href={hrefFor?.("negative")}
          {...rateProps("negative", kpis.negativeRate)}
        />
      </div>
      <div role="group" aria-label="Cần xử lý" className={GROUP}>
        <KpiCard
          id="safety"
          filteredBy={pin.safety}
          href={hrefFor?.("safety")}
          extraHref={hrefFor?.("severe")}
          {...rateProps("safety", kpis.safetyRiskRate)}
          extra={severe > 0 ? `${formatCount(severe)} nghiêm trọng` : undefined}
        />
        <KpiCard
          id="complaint"
          filteredBy={pin.intent}
          href={hrefFor?.("complaint")}
          {...rateProps("complaint", kpis.complaintRate)}
        />
      </div>
    </div>
  );
}

export function KpiCardsSkeleton() {
  return (
    <div className={GROUPS} aria-busy="true">
      <span className="sr-only">Đang tải…</span>
      {Array.from({ length: 3 }).map((_, g) => (
        <div key={g} className={GROUP}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-[3px] bg-[var(--enamel-white)]" />
          ))}
        </div>
      ))}
    </div>
  );
}
