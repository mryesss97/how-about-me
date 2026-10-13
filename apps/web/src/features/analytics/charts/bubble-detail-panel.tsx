"use client";

import type { SentimentLabel, TopicLabel } from "@how-about-me/taxonomy";
import Link from "next/link";
import { formatCount, formatRate } from "@/lib/format/number";
import { sentimentBadge } from "@/lib/semantics/badges";
import { bubbleMapCopy as copy } from "../copy";
import type { BubbleDatum } from "./bubble-layout";
import { SENTIMENT_COLORS, SENTIMENT_ORDER, shareOf } from "./chart-data";
import { SentimentIcon } from "./sentiment-icon";

export type BubbleHref = (topic: TopicLabel, sentiment: SentimentLabel | null) => string | null;

const linkCx =
  "font-medium text-brand-secondary underline-offset-2 outline-focus-ring hover:underline focus-visible:outline-2";

/** Detail panel (#222): 3-sentiment breakdown of the selected topic + FR-142 drill-down links (phase 1, no posts). */
export function BubbleDetailPanel({ datum, getHref }: { datum: BubbleDatum | null; getHref?: BubbleHref }) {
  const allHref = datum ? (getHref?.(datum.key, null) ?? null) : null;
  return (
    <aside aria-live="polite" className="flex flex-col gap-3 rounded-lg bg-secondary p-4 text-sm">
      {datum ? (
        <>
          <div>
            <h4 className="text-md font-semibold text-primary">{datum.name}</h4>
            <p className="text-tertiary">{copy.withSentiment(datum.total)}</p>
          </div>
          <ul className="flex flex-col gap-2">
            {SENTIMENT_ORDER.map((s) => {
              const count = datum[s];
              const share = shareOf(count, datum.total);
              const to = count > 0 ? (getHref?.(datum.key, s) ?? null) : null;
              const label = sentimentBadge[s].label;
              return (
                <li key={s} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <SentimentIcon sentiment={s} />
                      {to ? (
                        <Link href={to} className={linkCx}>
                          {label}
                        </Link>
                      ) : (
                        <span className="text-secondary">{label}</span>
                      )}
                    </span>
                    <span className="text-secondary tabular-nums">{`${formatCount(count)} · ${formatRate(share)}`}</span>
                  </div>
                  <span aria-hidden className="h-1.5 w-full rounded-full bg-tertiary">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(share ?? 0) * 100}%`, backgroundColor: SENTIMENT_COLORS[s] }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
          {allHref ? (
            <Link href={allHref} className={linkCx}>
              {copy.viewAll(datum.total)}
            </Link>
          ) : null}
        </>
      ) : (
        <p className="text-tertiary">{copy.hint}</p>
      )}
    </aside>
  );
}
