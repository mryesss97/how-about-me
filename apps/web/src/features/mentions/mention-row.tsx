"use client";

import type { MentionListItem } from "@how-about-me/contracts";
import { LinkExternal01 } from "@untitledui/icons";
import { forwardRef, type KeyboardEvent } from "react";
import { Badge } from "@/components/base/badges/badges";
import { AnalysisStatusBadge, ConfidenceMarker, SafetyBadge, SentimentBadge } from "@/features/shared/semantic-badge";
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
  onOpen: (id: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
};

/** One card row of the Mentions Explorer — UX §3.3, TC-MEN-002. */
export const MentionRow = forwardRef<HTMLElement, Props>(function MentionRow(
  { item, query, tz, onOpen, onKeyDown },
  ref,
) {
  const a = item.analysis;
  const link = safePermalink(item.permalink);
  // TC-MEN-021: queries whose exclude terms matched are not shown in the list (detail shows them, T-104).
  const queries = item.matchedQueries.filter((q) => !q.excludedByTerms);
  return (
    <article
      ref={ref}
      tabIndex={0}
      data-testid="mention-row"
      aria-label={`Bài nhắc của ${item.username ? `@${item.username}` : "người dùng không rõ"}`}
      onClick={() => onOpen(item.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen(item.id);
        onKeyDown?.(e);
      }}
      className="flex cursor-pointer flex-col gap-3 rounded-xl border border-secondary bg-primary p-4 outline-none hover:bg-primary_hover focus-visible:ring-2 focus-visible:ring-brand md:flex-row"
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
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="ml-auto text-tertiary hover:text-primary"
            >
              <LinkExternal01 className="size-4" aria-hidden />
            </a>
          ) : null}
        </div>
        <p className={cx("line-clamp-2 text-sm", item.text ? "text-primary" : "text-quaternary")}>
          {item.text ? <HighlightText text={item.text} query={query} /> : "Không có nội dung"}
        </p>
        {a.summary ? <p className="line-clamp-1 text-xs text-tertiary">{a.summary}</p> : null}
      </div>
      <div className="flex flex-wrap content-start items-start gap-1.5 md:w-72 md:justify-end">
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
          <span className="font-mono text-xs text-error-primary">{a.errorCode}</span>
        ) : null}
      </div>
    </article>
  );
});
