"use client";

import type { MentionListItem } from "@how-about-me/contracts";
import { LinkExternal01 } from "@untitledui/icons";
import Link from "next/link";
import { forwardRef, type KeyboardEvent, type MouseEvent } from "react";
import { Badge } from "@/components/base/badges/badges";
import { AnalysisStatusBadge, ConfidenceMarker, SafetyBadge, SentimentBadge } from "@/features/shared/semantic-badge";
import { analysisErrorLabel } from "@/lib/semantics/analysis-errors";
import { displayLabel, type LabelKind } from "@/lib/semantics/labels";
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

function LabelList({ labels, kind }: { labels: string[]; kind: LabelKind }) {
  if (labels.length === 0) return null;
  const rest = labels.length - MAX_LABELS;
  return (
    <>
      {labels.slice(0, MAX_LABELS).map((l) => (
        <Badge key={l} type="modern" color="gray" size="sm">
          {displayLabel(kind, l)}
        </Badge>
      ))}
      {rest > 0 ? (
        <Badge type="modern" color="gray" size="sm">
          +{rest}
        </Badge>
      ) : null}
    </>
  );
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
  const queries = item.matchedQueries.filter((q) => !q.excludedByTerms);
  return (
    // Whole card is clickable via a stretched link (#326); focus ring sits on the card (BR-017: not colour-only).
    <article
      data-testid="mention-row"
      className="relative flex cursor-pointer flex-col gap-3 rounded-xl border border-secondary bg-primary p-4 hover:bg-primary_hover has-[a[data-row-link]:focus-visible]:ring-2 has-[a[data-row-link]:focus-visible]:ring-brand md:flex-row"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-primary">Threads</span>
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
              className="relative z-10 ml-auto text-tertiary hover:text-primary"
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
          className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
        >
          <p className={cx("line-clamp-2 text-sm", item.text ? "text-primary" : "text-quaternary")}>
            {item.text ? <HighlightText text={item.text} query={query} /> : "Không có nội dung"}
          </p>
        </Link>
        {a.summary ? <p className="line-clamp-1 text-xs text-tertiary">{a.summary}</p> : null}
      </div>
      <div className="flex flex-wrap content-start items-start gap-1.5 md:w-72 md:justify-end">
        {a.status === "failed" && (a.sentiment || a.safety) ? (
          <span className="text-xs text-tertiary">Lần trước:</span>
        ) : null}
        {a.sentiment ? <SentimentBadge value={a.sentiment.label} /> : null}
        {a.safety ? <SafetyBadge value={a.safety.level} /> : null}
        <LabelList kind="intent" labels={a.intents.map((i) => i.label)} />
        <LabelList kind="topic" labels={a.topics.map((t) => t.label)} />
        {a.language ? (
          <Badge type="modern" color="gray" size="sm">
            {displayLabel("language", a.language)}
          </Badge>
        ) : null}
        {a.confidenceBand ? <ConfidenceMarker band={a.confidenceBand} /> : null}
        {a.status !== "completed" ? <AnalysisStatusBadge value={a.status} /> : null}
        {a.status === "failed" && a.errorCode ? (
          <span className="text-xs text-error-primary" title={a.errorCode}>
            {analysisErrorLabel(a.errorCode)}
          </span>
        ) : null}
      </div>
    </article>
  );
});
