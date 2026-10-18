"use client";

import type { MentionListItem } from "@how-about-me/contracts";
import { LinkExternal01 } from "@untitledui/icons";
import Link from "next/link";
import { forwardRef, type KeyboardEvent, type MouseEvent } from "react";
import { Badge } from "@/components/base/badges/badges";
import {
  AnalysisStatusBadge,
  ConfidenceMarker,
  RelevanceBadge,
  SafetyBadge,
  SentimentBadge,
  ValueSourceBadge,
} from "@/features/shared/semantic-badge";
import { analysisErrorLabel } from "@/lib/semantics/analysis-errors";
import { displayLabel } from "@/lib/semantics/labels";
import { formatDateTime, formatRelativeOrAbsolute, tzLabel } from "@/lib/time/format";
import { cx } from "@/utils/cx";
import { HighlightText } from "./highlight-text";

const MAX_LABELS = 2;

/** Only https links are rendered — defends against `javascript:` and other schemes (FR-157). */
export function safePermalink(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Normalises text for the summary-vs-text comparison (#337). */
const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

/** #337: the summary is hidden when it only repeats the start of the post text. */
export function summaryAddsInfo(summary: string | null, text: string | null): boolean {
  if (!summary) return false;
  if (!text) return true;
  const s = norm(summary).replace(/[.…]+$/, "");
  const t = norm(text);
  if (s.length === 0) return false;
  if (t.startsWith(s)) return false;
  // Summary is a near-verbatim prefix (≥ 80% of the text) — no new information.
  return !(s.length >= t.length * 0.8 && t.startsWith(s.slice(0, Math.floor(t.length * 0.8))));
}

/** #337: one muted line — max 2 intent/topic labels in total (+n), then language only when not `vi`. */
export function labelLine(a: MentionListItem["analysis"]): string {
  const labels = [
    ...a.intents.map((i) => displayLabel("intent", i.label)),
    ...a.topics.map((t) => displayLabel("topic", t.label)),
  ];
  const parts = labels.slice(0, MAX_LABELS);
  if (labels.length > MAX_LABELS) parts.push(`+${labels.length - MAX_LABELS}`);
  if (a.language && a.language !== "vi") parts.push(displayLabel("language", a.language));
  return parts.join(" · ");
}

type Props = {
  item: MentionListItem;
  query?: string | null;
  tz: string;
  /** Real link target (full page) — cmd/ctrl/middle-click opens it in a new tab (#326). */
  href: string;
  /** Plain left-click handler; when set, the click is intercepted (e.g. open the `?item=` slide-out). */
  onOpen?: (id: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLAnchorElement>) => void;
};

const isPlainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/** One card row of the Mentions Explorer — UX §3.3, TC-MEN-002. */
export const MentionRow = forwardRef<HTMLAnchorElement, Props>(function MentionRow(
  { item, query, tz, href, onOpen, onKeyDown },
  ref,
) {
  const a = item.analysis;
  const link = safePermalink(item.permalink);
  // TC-MEN-021: queries whose exclude terms matched are not shown in the list (detail shows them, T-104).
  const line = labelLine(a);
  const queries = item.matchedQueries.filter((q) => !q.excludedByTerms);
  return (
    // Whole card is clickable via a stretched link (#326); focus ring sits on the card (BR-017: not colour-only).
    <article
      data-testid="mention-row"
      className="relative flex cursor-pointer flex-col gap-3 rounded-xl border border-secondary bg-primary p-4 hover:bg-primary_hover has-[a[data-row-link]:focus-visible]:ring-2 has-[a[data-row-link]:focus-visible]:ring-brand md:flex-row"
    >
      {/* Below md the column is `contents` so verdicts sit between meta line and text (#337). */}
      <div className="contents md:flex md:min-w-0 md:flex-1 md:flex-col md:gap-2">
        <div className="order-1 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-secondary">{item.username ? `@${item.username}` : "—"}</span>
          <time
            dateTime={item.publishedAt}
            title={`${formatDateTime(item.publishedAt, tz)} (${tzLabel(tz)})`}
            className="text-tertiary"
          >
            {formatRelativeOrAbsolute(item.publishedAt, new Date(), tz)}
          </time>
          {queries.map((q) => (
            <Badge key={q.id} type="pill-color" color="brand" size="sm">
              {q.displayName}
            </Badge>
          ))}
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Mở trên Threads"
              className="relative z-10 -m-3 ml-auto inline-flex size-11 items-center justify-center text-tertiary hover:text-primary md:m-0 md:ml-auto md:size-auto"
            >
              <LinkExternal01 className="size-4" aria-hidden />
            </a>
          ) : null}
        </div>
        <Link
          ref={ref}
          href={href}
          prefetch={false}
          data-row-link=""
          aria-label={`Bài nhắc của ${item.username ? `@${item.username}` : "người dùng không rõ"}`}
          onClick={(e) => {
            if (!onOpen || !isPlainClick(e)) return;
            e.preventDefault();
            onOpen(item.id);
          }}
          onKeyDown={onKeyDown}
          className="order-3 outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
        >
          <p className={cx("line-clamp-2 text-sm", item.text ? "text-primary" : "text-quaternary")}>
            {item.text ? <HighlightText text={item.text} query={query} /> : "Không có nội dung"}
          </p>
        </Link>
        {summaryAddsInfo(a.summary, item.text) ? (
          <p className="order-4 line-clamp-1 text-xs text-tertiary">{a.summary}</p>
        ) : null}
        {line ? <p className="order-4 truncate text-xs text-tertiary">{line}</p> : null}
      </div>
      {/* #337: verdicts only — quiet defaults (safe, relevant, high, completed) render nothing (BR-017, BR-021). */}
      <div
        data-testid="mention-verdicts"
        className="order-2 flex flex-wrap content-start items-start gap-1.5 md:order-none md:w-44 md:flex-col md:items-end"
      >
        {a.status === "failed" && (a.sentiment || a.safety) ? (
          <span className="text-xs text-tertiary">Lần trước:</span>
        ) : null}
        {a.sentiment ? <SentimentBadge value={a.sentiment.label} /> : null}
        {a.safety && a.safety.level !== "safe" ? <SafetyBadge value={a.safety.level} /> : null}
        {a.relevance && a.relevance.label !== "relevant" ? <RelevanceBadge value={a.relevance.label} /> : null}
        {a.hasOverride ? <ValueSourceBadge source="analyst" /> : null}
        {a.status !== "completed" ? <AnalysisStatusBadge value={a.status} /> : null}
        {a.status === "failed" && a.errorCode ? (
          <span className="text-xs text-error-primary" title={a.errorCode}>
            {analysisErrorLabel(a.errorCode)}
          </span>
        ) : null}
        {a.confidenceBand === "low" ? <ConfidenceMarker band="low" /> : null}
      </div>
    </article>
  );
});
