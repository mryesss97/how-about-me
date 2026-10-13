"use client";

import type { OverviewResponse } from "@how-about-me/contracts";
import { ArrowDown, ArrowUp, InfoCircle, Minus } from "@untitledui/icons";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { DASH, type Direction, formatCount, formatGrowth, formatRate, formatRateDelta } from "@/lib/format/number";
import { type KpiId, kpiDefinition } from "./kpi-definitions";

export const EMPTY_VALUE_TOOLTIP = "No analysed mentions in range";

type Delta = { text: string; direction: Direction | "new" };

const ARROWS = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;

/** Delta colour is neutral on purpose: "up" is bad for negative/safety/complaint rates. */
function DeltaBadge({ delta }: { delta: Delta }) {
  if (delta.direction === "new") {
    return (
      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary">{delta.text}</span>
    );
  }
  const Icon = ARROWS[delta.direction];
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-secondary">
      <Icon aria-hidden="true" className="size-4" />
      {delta.text}
    </span>
  );
}

export function KpiCard({
  id,
  value,
  delta,
  subText,
  extra,
}: {
  id: KpiId;
  value: string;
  delta?: Delta | null;
  subText?: string;
  extra?: string;
}) {
  const { label, definition, denominator } = kpiDefinition(id);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-secondary bg-primary p-4 shadow-xs">
      <div className="flex items-center gap-1">
        <h3 className="text-sm font-medium text-tertiary">{label}</h3>
        {/* FR-140: definition + denominator from doc 07. */}
        <Tooltip title={definition} description={`Denominator: ${denominator}`}>
          <TooltipTrigger aria-label={`About ${label}`} className="text-quaternary">
            <InfoCircle aria-hidden="true" className="size-4" />
          </TooltipTrigger>
        </Tooltip>
      </div>
      <div className="flex flex-wrap items-baseline gap-2">
        {value === DASH ? (
          // BR-032: "—" means no denominator, distinct from a real 0%.
          <Tooltip title={EMPTY_VALUE_TOOLTIP}>
            <TooltipTrigger aria-label={EMPTY_VALUE_TOOLTIP} className="text-display-xs font-semibold text-primary">
              {DASH}
            </TooltipTrigger>
          </Tooltip>
        ) : (
          <span className="text-display-xs font-semibold text-primary">{value}</span>
        )}
        {delta ? <DeltaBadge delta={delta} /> : null}
      </div>
      {subText ? <p className="text-xs text-tertiary">{subText}</p> : null}
      {extra ? <p className="text-xs font-medium text-secondary">{extra}</p> : null}
    </div>
  );
}

type Rate = OverviewResponse["kpis"]["positiveRate"];

function rateProps(rate: Rate) {
  return {
    value: formatRate(rate.value),
    // Only present when compare=true (doc 07 §2); otherwise no delta.
    delta: formatRateDelta(rate.value, rate.previous),
    subText: `of ${formatCount(rate.denominator)} analysed`,
  };
}

const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6";

/** FR-132: six KPI cards for /overview. */
export function KpiCards({ kpis }: { kpis: OverviewResponse["kpis"] }) {
  const m = kpis.mentionCount;
  const growthDelta: Delta | null =
    m.growthState === "new" ? null : { text: formatGrowth(m.growthPct, m.growthState), direction: m.growthState };
  const severe = kpis.safetyRiskRate.severeCount;
  return (
    <div className={GRID}>
      <KpiCard id="mentions" value={formatCount(m.value)} subText="distinct relevant posts" />
      <KpiCard
        id="growth"
        value={m.growthState === "new" ? "New" : formatGrowth(m.growthPct, m.growthState)}
        delta={growthDelta ? { ...growthDelta, text: "vs previous" } : null}
        subText={m.previous == null ? undefined : `previous: ${formatCount(m.previous)}`}
      />
      <KpiCard id="positive" {...rateProps(kpis.positiveRate)} />
      <KpiCard id="negative" {...rateProps(kpis.negativeRate)} />
      <KpiCard
        id="safety"
        {...rateProps(kpis.safetyRiskRate)}
        extra={severe > 0 ? `${formatCount(severe)} severe` : undefined}
      />
      <KpiCard id="complaint" {...rateProps(kpis.complaintRate)} />
    </div>
  );
}

export function KpiCardsSkeleton() {
  return (
    <div className={GRID} aria-busy="true">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl border border-secondary bg-secondary" />
      ))}
    </div>
  );
}
