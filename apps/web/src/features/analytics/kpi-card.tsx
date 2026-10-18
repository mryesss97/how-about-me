"use client";

import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp, Minus } from "@untitledui/icons";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { DASH, type Direction } from "@/lib/format/number";
import { cx } from "@/utils/cx";
import { KpiInfoButton } from "./kpi-info-button";
import { type KpiId, kpiDefinition } from "./kpi-definitions";

export const EMPTY_VALUE_TOOLTIP = "Chưa có bài nhắc đã phân tích trong khoảng này";
export const KPI_DRILL_HINT = "Xem bài nhắc";

export type Delta = { text: string; direction: Direction | "new" };

const ARROWS = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;

/**
 * Delta colour is neutral on purpose: "up" is bad for negative/safety/complaint rates.
 * Arrows are drawn icons, never glyphs (DESIGN.md); no rounded pill (#275).
 */
function DeltaBadge({ delta }: { delta: Delta }) {
  if (delta.direction === "new") {
    return <span className="text-sm font-medium text-secondary">{delta.text}</span>;
  }
  const Icon = ARROWS[delta.direction];
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-secondary">
      <Icon aria-hidden="true" className="size-4" />
      {delta.text}
    </span>
  );
}

/** Optional enamel tint for the figure; only where the label names the sentiment (BR-017). */
export type KpiTone = "positive" | "negative";
const TONE_CLASS: Record<KpiTone, string> = {
  positive: "text-[var(--green-enamel)]",
  negative: "text-[var(--red-enamel)]",
};

export function KpiCard({
  id,
  value,
  delta,
  subText,
  extra,
  href,
  extraHref,
  tone,
  filteredBy,
}: {
  id: KpiId;
  /** #335: the global filter pins this card's dimension ("Cảm xúc: Tiêu cực") — figure goes ink, state is named. */
  filteredBy?: string;
  value: string;
  tone?: KpiTone;
  delta?: Delta | null;
  subText?: string;
  extra?: string;
  /** FR-142 drill-down to /mentions. Stretched link; tooltip triggers sit above it (no nested interactive). */
  href?: string;
  extraHref?: string;
}) {
  const { label, definition, denominator } = kpiDefinition(id);
  return (
    <div
      className={cx(
        "operate-board group flex h-full flex-col gap-2 p-4",
        href &&
          "has-[>a:hover]:bg-primary_hover has-[>a:focus-visible]:outline-2 has-[>a:focus-visible]:outline-focus-ring",
      )}
    >
      <span aria-hidden className="sign-keyline" />
      {href ? (
        <Link
          href={href}
          aria-label={`Xem bài nhắc: ${label}`}
          className="absolute inset-0 rounded-[3px] outline-none"
        />
      ) : null}
      {/* 2 lines reserved so figures share a baseline when a label wraps (#335). */}
      <div className="flex min-h-[2lh] items-start gap-1">
        <h3 className="kpi-label">{label}</h3>
        {/* FR-140: definition + denominator from doc 07. */}
        <KpiInfoButton label={label} definition={definition} denominator={denominator} />
      </div>
      <div className="flex flex-wrap items-baseline gap-2">
        {value === DASH ? (
          // BR-032: "—" means no denominator, distinct from a real 0%.
          <Tooltip title={EMPTY_VALUE_TOOLTIP}>
            <TooltipTrigger aria-label={EMPTY_VALUE_TOOLTIP} className="kpi-figure relative z-10 text-[var(--ink)]">
              {DASH}
            </TooltipTrigger>
          </Tooltip>
        ) : (
          // #335 / BR-017: a pinned filter makes the rate structural (e.g. 100 % / 0 %) — no alarm colour then.
          <span className={cx("kpi-figure", tone && !filteredBy ? TONE_CLASS[tone] : "text-[var(--ink)]")}>
            {value}
          </span>
        )}
        {delta ? <DeltaBadge delta={delta} /> : null}
      </div>
      {subText ? <p className="text-xs text-tertiary">{subText}</p> : null}
      {filteredBy ? <p className="text-xs text-tertiary">{`Đang lọc theo ${filteredBy}`}</p> : null}
      {extra && extraHref ? (
        <Link
          href={extraHref}
          className="relative z-10 inline-flex items-center self-start text-xs max-md:min-h-11 font-medium text-secondary underline-offset-2 hover:underline"
        >
          {extra}
        </Link>
      ) : extra ? (
        <p className="text-xs font-medium text-secondary">{extra}</p>
      ) : null}
      {/* FR-142 (#335): visible drill-down affordance; visual only — the stretched link is the control. */}
      {href ? (
        <span
          aria-hidden
          className="mt-auto inline-flex items-center gap-1 pt-1 text-xs text-secondary underline-offset-2 group-has-[>a:hover]:underline group-has-[>a:focus-visible]:underline"
        >
          {KPI_DRILL_HINT}
          <ArrowRight className="size-3.5" />
        </span>
      ) : null}
    </div>
  );
}
