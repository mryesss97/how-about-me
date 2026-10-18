"use client";

import type { TopicSentimentResponse } from "@how-about-me/contracts";
import type { SentimentLabel, TopicLabel } from "@how-about-me/taxonomy";
import Link from "next/link";
import type { QueryStateError } from "@/features/shared/query-state";
import { formatCount, formatRate } from "@/lib/format/number";
import { displayLabel } from "@/lib/semantics/labels";
import { ChartCard } from "./chart-card";
import { SENTIMENT_COLORS, heatmapOpacity, shareOf } from "./chart-data";
import { MultiLabelNote } from "./horizontal-bar-chart";

type Row = TopicSentimentResponse["rows"][number];

/** #327: negative first so the column that matters most is never the one cut off on narrow screens. */
export const HEATMAP_ORDER: readonly SentimentLabel[] = ["negative", "neutral", "positive"];

export type TopicSentimentHeatmapProps = {
  data?: TopicSentimentResponse;
  isLoading?: boolean;
  error?: QueryStateError | null;
  onRetry?: () => void;
  className?: string;
  /** FR-142: cell → `topic=t&sentiment=s`; `sentiment = null` drills the whole topic (table row header). */
  getCellHref?: (topic: TopicLabel, sentiment: SentimentLabel | null) => string | null;
};

/**
 * Topic × sentiment heatmap (FR-144, T-149). Rows = all taxonomy topics in API order, columns = sentiment.
 * Each cell prints "count · share within the row" (NFR-030: colour intensity is never the only cue); share
 * denominator = topic row total (posts with that topic and a sentiment). Non-zero cells are links (FR-142).
 */
export function TopicSentimentHeatmap({
  data,
  isLoading,
  error,
  onRetry,
  className,
  getCellHref,
}: TopicSentimentHeatmapProps) {
  const rows = data?.rows ?? [];
  const table = {
    rowHrefs: rows.map((r) => (r.total > 0 ? (getCellHref?.(r.topic, null) ?? null) : null)),
    columns: ["Chủ đề", "Tiêu cực", "Trung tính", "Tích cực", "Có cảm xúc", "Tỷ lệ tiêu cực"],
    rows: rows.map((r) => [
      displayLabel("topic", r.topic),
      formatCount(r.negative),
      formatCount(r.neutral),
      formatCount(r.positive),
      formatCount(r.total),
      formatRate(r.negativeShare),
    ]),
  };

  return (
    <ChartCard
      title="Chủ đề × cảm xúc"
      description="Lượt nhắc theo chủ đề, tỷ lệ trong từng chủ đề"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!!data && rows.every((r) => r.total === 0)}
      emptyTitle="Chưa có lượt nhắc đã phân tích trong khoảng này"
      table={table}
      className={className}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th scope="col" className="text-left text-xs font-medium text-tertiary">
                Chủ đề
              </th>
              {HEATMAP_ORDER.map((s) => (
                <th key={s} scope="col" className="text-xs font-medium text-tertiary">
                  {displayLabel("sentiment", s)}
                </th>
              ))}
              <th scope="col" className="hidden text-right text-xs font-medium text-tertiary sm:table-cell">
                Có cảm xúc
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.topic}>
                <th scope="row" className="pr-2 text-left font-medium text-secondary sm:whitespace-nowrap">
                  {displayLabel("topic", r.topic)}
                  {/* #327: total folds into the row header under sm (the total column is hidden). */}
                  <span className="block text-xs font-normal text-tertiary tabular-nums sm:hidden">
                    {formatCount(r.total)} có cảm xúc
                  </span>
                </th>
                {HEATMAP_ORDER.map((s) => (
                  <HeatmapCell key={s} row={r} sentiment={s} href={getCellHref} />
                ))}
                <td className="hidden text-right text-tertiary tabular-nums sm:table-cell">{formatCount(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MultiLabelNote noun="chủ đề" />
    </ChartCard>
  );
}

function HeatmapCell({
  row,
  sentiment,
  href,
}: {
  row: Row;
  sentiment: SentimentLabel;
  href: TopicSentimentHeatmapProps["getCellHref"];
}) {
  const count = row[sentiment];
  const share = shareOf(count, row.total);

  const to = count > 0 ? (href?.(row.topic, sentiment) ?? null) : null;
  const label = `${displayLabel("topic", row.topic)} · ${displayLabel("sentiment", sentiment)}: ${formatCount(count)} lượt nhắc, ${formatRate(share)} trên ${formatCount(row.total)} có cảm xúc`;
  return (
    <td className="relative h-11 min-w-16 rounded-md sm:h-9 sm:min-w-24 p-0 text-center tabular-nums">
      {/* Background layer: sentiment hue (never safety colours, BR-017) at an opacity set by the row share. */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-md"
        style={{ backgroundColor: SENTIMENT_COLORS[sentiment], opacity: heatmapOpacity(share) }}
      />
      {to ? (
        <Link
          href={to}
          aria-label={label}
          title={label}
          className="relative flex h-full items-center justify-center rounded-md px-2 font-medium text-primary outline-focus-ring hover:underline focus-visible:outline-2"
        >
          <CellText count={count} share={share} />
        </Link>
      ) : (
        <span title={label} className="relative flex h-full items-center justify-center px-2 text-tertiary">
          <CellText count={count} share={share} />
        </span>
      )}
    </td>
  );
}

/** BR-017: count text is always printed. Under sm it splits into two lines so cells fit 390px. */
function CellText({ count, share }: { count: number; share: number | null }) {
  return (
    <span className="flex flex-col text-xs leading-tight sm:flex-row sm:text-sm sm:whitespace-pre">
      <span>{formatCount(count)}</span>
      <span aria-hidden className="hidden sm:inline">
        {" · "}
      </span>
      <span>{formatRate(share)}</span>
    </span>
  );
}
