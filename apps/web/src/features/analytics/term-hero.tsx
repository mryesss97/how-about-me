"use client";

import { ArrowDown, ArrowLeft, ArrowUp } from "@untitledui/icons";
import Link from "next/link";
import { useLandingTerms } from "@/features/shared/use-landing-terms";
import { serializeFilters } from "@/lib/filters/parsers";
import type { Filters } from "@/lib/filters/schema";
import { formatCount, formatRate } from "@/lib/format/number";
import { termDetailCopy as copy } from "./copy";
import type { termChange } from "./term-compare";
import type { termSplit } from "./term-detail-view";

type Sentiment = "positive" | "neutral" | "negative";
const ORDER: Sentiment[] = ["positive", "neutral", "negative"];
export const TERM_LIST_ANCHOR = "bai-nhac";

/** Same page with `list=<k>` and the mentions board as hash (#333 entry-3); the filter query is kept. */
export function splitHref(filters: Filters, list: Sentiment): string {
  const qs = new URLSearchParams(serializeFilters(filters).replace(/^\?/, ""));
  qs.set("list", list);
  return `?${qs.toString()}#${TERM_LIST_ANCHOR}`;
}

type Split = ReturnType<typeof termSplit>;
type Change = ReturnType<typeof termChange>;

interface TermHeroProps {
  term: string;
  filters: Filters;
  split: Split;
  loaded: boolean;
  change: Change | null;
  /** Labels of active enum filters; hero ignores them (#333 entry-1) and says so. */
  filteredLabels: string[];
}

/** Phrase hero (#276, #333): independent of enum filters — only range, timezone, relevance and term (BR-042, BR-016). */
export function TermHero({ term, filters, split, loaded, change, filteredLabels }: TermHeroProps) {
  return (
    <section aria-labelledby="term-title" data-tone={split.tone} className="sign-board term-hero">
      <span aria-hidden className="sign-keyline" />
      <div className="relative flex flex-col gap-5 p-6 sm:p-8">
        <div>
          <Link href="/" className="term-hero-link">
            <ArrowLeft aria-hidden className="size-4" />
            {copy.back}
          </Link>
        </div>
        <h1 id="term-title" className="term-hero-phrase">
          &quot;{term}&quot;
        </h1>
        {!loaded ? (
          <p className="term-hero-figure opacity-50">—</p>
        ) : split.total === 0 ? (
          <p className="term-hero-figure">{copy.none}</p>
        ) : (
          <>
            <p className="term-hero-figure">
              {formatRate(split.share)} {copy.sentiment[split.dominant]} ·{" "}
              {copy.withSentiment(formatCount(split.total))} · {copy.period(filters)}
            </p>
            {change ? <ChangeLine change={change} /> : null}
            <div className="term-split">
              <p className="sr-only">{copy.splitLabel}</p>
              <div aria-hidden className="flex h-3 w-full overflow-hidden rounded-[2px]">
                {ORDER.map((k) => (
                  <span
                    key={k}
                    className={`term-split-${k}`}
                    style={{ width: `${(split.counts[k] / split.total) * 100}%` }}
                  />
                ))}
              </div>
              <ul className="mt-3 grid grid-cols-3 gap-3">
                {ORDER.map((k) => {
                  const rate = formatRate(split.counts[k] / split.total);
                  const n = formatCount(split.counts[k]);
                  return (
                    <li key={k}>
                      {/* BR-017: the link name carries the word, not only the colour. */}
                      <Link
                        href={splitHref(filters, k)}
                        aria-label={copy.splitLink(copy.sentiment[k], rate, n)}
                        className="flex min-h-11 flex-col rounded-[2px] hover:underline"
                      >
                        <span className="text-xs font-medium text-secondary">{copy.sentiment[k]}</span>
                        <span className="term-split-figure">
                          {rate}
                          <span className="ml-1.5 text-xs font-medium text-tertiary">({n})</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
        {filteredLabels.length > 0 ? <p className="text-xs">{copy.filteredNote(filteredLabels.join(", "))}</p> : null}
        <p className="max-w-[70ch] text-xs">{copy.matchNote}</p>
      </div>
    </section>
  );
}

/** Change vs previous period (#333 entry-5): neutral colour, the words carry the meaning (BR-017). */
function ChangeLine({ change }: { change: Change }) {
  const Icon = change.state === "up" ? ArrowUp : change.state === "down" ? ArrowDown : null;
  const head =
    change.state === "new"
      ? copy.newTerm
      : change.state === "flat"
        ? copy.flat
        : copy.change(formatRate(Math.abs(change.pct ?? 0)));
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="inline-flex flex-wrap items-center gap-1.5">
        {Icon ? <Icon aria-hidden className="size-4" /> : null}
        <span>
          {change.state === "down" ? "−" : ""}
          {head}
          {change.state === "new" ? "" : ` · ${copy.previous(formatCount(change.previousTotal))}`}
        </span>
      </p>
      {change.prevNegShare != null ? (
        <p>{copy.negativeVsPrevious(formatRate(change.negShare), formatRate(change.prevNegShare))}</p>
      ) : null}
    </div>
  );
}

const norm = (s: string) => s.trim().toLowerCase();

/** "Cụm từ khác:" (#333 entry-9): other configured landing terms in rank order; nothing for unconfigured terms. */
export function TermSiblings({
  pid,
  term,
  filters,
  range,
}: {
  pid: string | undefined;
  term: string;
  filters: Filters;
  range: { from: string; to: string; timezone: string };
}) {
  const landing = useLandingTerms(pid, range);
  const rows = landing.data?.rows ?? [];
  if (!rows.some((r) => norm(r.term) === norm(term))) return null;
  const others = rows.filter((r) => norm(r.term) !== norm(term));
  if (others.length === 0) return null;
  const qs = serializeFilters({ preset: filters.preset, from: filters.from, to: filters.to, tz: filters.tz });
  return (
    <nav aria-label={copy.otherTerms} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-secondary">{copy.otherTerms}</span>
      {others.map((r) => (
        <Link key={r.term} href={`/terms/${encodeURIComponent(r.term)}${qs}`} className="task-plate !text-xs">
          {r.term}
        </Link>
      ))}
    </nav>
  );
}
