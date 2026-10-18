"use client";

import type { PhraseSentimentResponse, TopicSentimentResponse } from "@how-about-me/contracts";
import { useMemo, useState } from "react";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import type { QueryStateError } from "@/features/shared/query-state";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { formatCount, formatRate } from "@/lib/format/number";
import { sentimentBadge } from "@/lib/semantics/badges";
import { bubbleMapCopy as copy } from "../copy";
import { BubbleCanvas } from "./bubble-canvas";
import { type BubbleMode, BubbleModeToggle, emptyState } from "./bubble-mode";
import { type BubbleHref, BubbleDetailPanel } from "./bubble-detail-panel";
import { type BubbleFilter, filterBubbles, toPhraseBubbles, toTopicBubbles } from "./bubble-layout";
import { ChartCard } from "./chart-card";
import { SENTIMENT_COLORS } from "./chart-data";
import { MultiLabelNote } from "./horizontal-bar-chart";
import { SentimentIcon } from "./sentiment-icon";
import { TopicSentimentTable } from "./topic-sentiment-table";

export type SentimentBubbleMapProps = {
  /** Topics mode data (topic-sentiment). */
  data?: TopicSentimentResponse;
  /** #243: Phrases mode data (analytics/phrases, FR-148). */
  phraseData?: PhraseSentimentResponse;
  /** #243: controlled Topics | Phrases toggle (local state of the parent, not in the URL). Default topics. */
  mode?: BubbleMode;
  /** Toggle is shown only when provided. */
  onModeChange?: (mode: BubbleMode) => void;
  /** Loading / error / retry of the query behind the current mode. */
  isLoading?: boolean;
  error?: QueryStateError | null;
  onRetry?: () => void;
  className?: string;
  /**
   * FR-142: (key, sentiment) → `topic=t&sentiment=s` (Topics) or `phrase=p&sentiment=s` (Phrases); sentiment null
   * drills the whole key. The parent picks the mapping for the current mode.
   */
  getHref?: BubbleHref;
};

/** Chip order follows the brand guide v2 prototype. */
const FILTERS: readonly BubbleFilter[] = ["all", "negative", "positive", "neutral"];
/**
 * Sentiment map (#222, FR-144): one bubble per topic with sentiment. Area ∝ mentions with sentiment, colour =
 * dominant sentiment (tie: negative > positive > neutral), tint + % = dominant share. Chips filter by dominant
 * sentiment (local state, not in the URL) and apply to both bubbles and table. Multi-label: no totals.
 */
export function SentimentBubbleMap({
  data,
  phraseData,
  mode = "topics",
  onModeChange,
  isLoading,
  error,
  onRetry,
  className,
  getHref,
}: SentimentBubbleMapProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [filter, setFilter] = useState<BubbleFilter>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const phrases = mode === "phrases";

  const all = useMemo(
    () => (phrases ? toPhraseBubbles(phraseData?.rows ?? []) : toTopicBubbles(data?.rows ?? [])),
    [phrases, phraseData, data],
  );
  const current = phrases ? phraseData : data;
  const empty = current ? emptyState(mode, all, phraseData) : null;
  const shown = useMemo(() => filterBubbles(all, filter), [all, filter]);
  const visible = useMemo(() => new Set(shown.map((d) => d.key)), [shown]);
  // A selected bubble that is filtered out is deselected.
  const selected = shown.find((d) => d.key === selectedKey) ?? null;

  const table = {
    columns: phrases ? copy.phraseTableColumns : copy.tableColumns,
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

  // #336: Topics "Bảng" view = the old heatmap cells (count · share, link per cell), same rows/order as the bubbles
  // so the chip filter applies. Phrases keep the plain text table.
  const topicRows = useMemo(() => {
    const byTopic = new Map((data?.rows ?? []).map((r) => [r.topic as string, r]));
    return shown.flatMap((d) => byTopic.get(d.key) ?? []);
  }, [data, shown]);
  const tableView = phrases ? undefined : (
    <TopicSentimentTable caption={`${copy.title} (bảng)`} rows={topicRows} getCellHref={getHref} />
  );

  const filterChips = (
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

  const toolbar = <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">{filterChips}</div>;

  // #243: mode switch lives in the header so it stays reachable in empty/error states (QA blocker).
  const modeToggle = onModeChange ? (
    <BubbleModeToggle
      mode={mode}
      onChange={(m) => {
        setSelectedKey(null); // keys can collide across modes (topic "price" vs phrase "price")
        onModeChange(m);
      }}
    />
  ) : null;

  const count = !phrases
    ? copy.topicCount(shown.length)
    : phraseData && filter === "all" && phraseData.totalPhrases > shown.length
      ? copy.phraseTop(shown.length, phraseData.totalPhrases)
      : copy.phraseCount(shown.length);

  const footer = (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-tertiary">
        <span>{copy.legend}</span>
        <span className="tabular-nums">{count}</span>
      </div>
      <MultiLabelNote noun={phrases ? "cụm từ" : "chủ đề"} />
    </div>
  );

  return (
    <ChartCard
      title={copy.title}
      description={phrases ? copy.descriptionPhrases : copy.description}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!!empty}
      emptyTitle={empty?.title ?? copy.empty}
      emptyDescription={empty?.description}
      tableView={tableView}
      toolbar={toolbar}
      headerAction={modeToggle}
      footer={footer}
      table={table}
      className={className}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="relative">
          <BubbleCanvas
            key={mode} // remount → grow-in again when switching mode
            all={all}
            visible={visible}
            selected={selected?.key ?? null}
            onSelect={setSelectedKey}
            reducedMotion={reducedMotion}
          />
          {filter !== "all" && shown.length === 0 ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-tertiary">
              {phrases ? copy.emptyFilteredPhrases(filter) : copy.emptyFiltered(filter)}
            </p>
          ) : null}
        </div>
        <BubbleDetailPanel datum={selected} getHref={getHref} />
      </div>
    </ChartCard>
  );
}
