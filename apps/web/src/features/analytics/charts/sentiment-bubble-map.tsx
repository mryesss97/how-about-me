"use client";

import type { TopicSentimentResponse } from "@how-about-me/contracts";
import type { TopicLabel } from "@how-about-me/taxonomy";
import { useMemo, useState } from "react";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import type { QueryStateError } from "@/features/shared/query-state";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { formatCount, formatRate } from "@/lib/format/number";
import { sentimentBadge } from "@/lib/semantics/badges";
import { bubbleMapCopy as copy } from "../copy";
import { BubbleCanvas } from "./bubble-canvas";
import { type BubbleHref, BubbleDetailPanel } from "./bubble-detail-panel";
import { type BubbleFilter, filterBubbles, toBubbleData } from "./bubble-layout";
import { ChartCard } from "./chart-card";
import { SENTIMENT_COLORS } from "./chart-data";
import { MultiLabelNote } from "./horizontal-bar-chart";
import { SentimentIcon } from "./sentiment-icon";

export type SentimentBubbleMapProps = {
  data?: TopicSentimentResponse;
  isLoading?: boolean;
  error?: QueryStateError | null;
  onRetry?: () => void;
  className?: string;
  /** FR-142: (topic, sentiment) → `topic=t&sentiment=s`; sentiment null drills the whole topic. */
  getHref?: BubbleHref;
};

/** Chip order follows the brand guide v2 prototype. */
const FILTERS: readonly BubbleFilter[] = ["all", "negative", "positive", "neutral"];

/**
 * Sentiment map (#222, FR-144): one bubble per topic with sentiment. Area ∝ mentions with sentiment, colour =
 * dominant sentiment (tie: negative > positive > neutral), tint + % = dominant share. Chips filter by dominant
 * sentiment (local state, not in the URL) and apply to both bubbles and table. Multi-label: no totals.
 */
export function SentimentBubbleMap({ data, isLoading, error, onRetry, className, getHref }: SentimentBubbleMapProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [filter, setFilter] = useState<BubbleFilter>("all");
  const [selectedKey, setSelectedKey] = useState<TopicLabel | null>(null);

  const all = useMemo(() => toBubbleData(data?.rows ?? []), [data]);
  const shown = useMemo(() => filterBubbles(all, filter), [all, filter]);
  const visible = useMemo(() => new Set(shown.map((d) => d.key)), [shown]);
  // A selected bubble that is filtered out is deselected.
  const selected = shown.find((d) => d.key === selectedKey) ?? null;

  const table = {
    columns: copy.tableColumns,
    rows: shown.map((d) => [
      d.name,
      sentimentBadge[d.dominant].label,
      formatRate(d.dominantShare),
      formatCount(d.positive),
      formatCount(d.neutral),
      formatCount(d.negative),
      formatCount(d.total),
    ]),
    rowHrefs: shown.map((d) => getHref?.(d.key, null) ?? null),
  };

  const toolbar = (
    <ButtonGroup
      size="sm"
      aria-label={copy.filterLabel}
      disallowEmptySelection
      selectedKeys={[filter]}
      onSelectionChange={(keys) => {
        const next = [...keys][0];
        if (typeof next === "string") setFilter(next as BubbleFilter);
      }}
    >
      {FILTERS.map((f) => {
        const count = f === "all" ? all.length : all.filter((d) => d.dominant === f).length;
        return (
          <ButtonGroupItem key={f} id={f}>
            {f === "all" ? null : (
              <>
                <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: SENTIMENT_COLORS[f] }} />
                <SentimentIcon sentiment={f} />
              </>
            )}
            {`${f === "all" ? copy.filterAll : sentimentBadge[f].label} (${count})`}
          </ButtonGroupItem>
        );
      })}
    </ButtonGroup>
  );

  const footer = (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-tertiary">
        <span>{copy.legend}</span>
        <span className="tabular-nums">{copy.topicCount(shown.length)}</span>
      </div>
      <MultiLabelNote noun="topics" />
    </div>
  );

  return (
    <ChartCard
      title={copy.title}
      description={copy.description}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!!data && all.length === 0}
      emptyTitle={copy.empty}
      viewToggle={{ chart: copy.viewChart, table: copy.viewTable }}
      toolbar={toolbar}
      footer={footer}
      table={table}
      className={className}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="relative">
          <BubbleCanvas
            all={all}
            visible={visible}
            selected={selected?.key ?? null}
            onSelect={setSelectedKey}
            reducedMotion={reducedMotion}
          />
          {filter !== "all" && shown.length === 0 ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-tertiary">
              {copy.emptyFiltered(filter)}
            </p>
          ) : null}
        </div>
        <BubbleDetailPanel datum={selected} getHref={getHref} />
      </div>
    </ChartCard>
  );
}
