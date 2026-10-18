"use client";

import type { TopicSentimentResponse } from "@how-about-me/contracts";
import type { SentimentLabel, TopicLabel } from "@how-about-me/taxonomy";
import Link from "next/link";
import { formatCount, formatRate } from "@/lib/format/number";
import { displayLabel } from "@/lib/semantics/labels";
import { SENTIMENT_COLORS, heatmapOpacity, shareOf } from "./chart-data";

type Row = TopicSentimentResponse["rows"][number];

/** #327: negative first so the column that matters most is never the one cut off on narrow screens. */
export const HEATMAP_ORDER: readonly SentimentLabel[] = ["negative", "neutral", "positive"];

/** FR-142: cell → `topic=t&sentiment=s`; `sentiment = null` drills the whole topic. */
export type TopicSentimentCellHref = (topic: TopicLabel, sentiment: SentimentLabel | null) => string | null;

/**
 * Topic × sentiment cells (FR-144, T-149), shown as the "Bảng" view of the sentiment map since #336 (the separate
 * heatmap card is gone). Each cell prints "count · share within the row" (NFR-030: colour intensity is never the only
 * cue); share denominator = topic row total (posts with that topic and a sentiment). Non-zero cells are links (FR-142).
 */
export function TopicSentimentTable({
  rows,
  getCellHref,
  caption,
}: {
  rows: readonly Row[];
  getCellHref?: TopicSentimentCellHref;
  caption: string;
}) {
  return (
    <div className="max-h-[26rem] overflow-auto">
      <table aria-label={caption} className="w-full border-separate border-spacing-1 text-sm">
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
  );
}

function HeatmapCell({
  row,
  sentiment,
  href,
}: {
  row: Row;
  sentiment: SentimentLabel;
  href: TopicSentimentCellHref | undefined;
}) {
  const count = row[sentiment];
  const share = shareOf(count, row.total);

  const to = count > 0 ? (href?.(row.topic, sentiment) ?? null) : null;
  const label = `${displayLabel("topic", row.topic)} · ${displayLabel("sentiment", sentiment)}: ${formatCount(count)} bài nhắc, ${formatRate(share)} trên ${formatCount(row.total)} có cảm xúc`;
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
