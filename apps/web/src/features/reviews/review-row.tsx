"use client";

import type { ReviewQueueItem, ReviewReason } from "@how-about-me/contracts";
import { Edit05 } from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { AnalysisStatusBadge, RelevanceBadge, SentimentBadge } from "@/features/shared/semantic-badge";
import { formatDateTime, formatRelativeOrAbsolute, tzLabel } from "@/lib/time/format";
import { cx } from "@/utils/cx";

export const REASON_LABEL: Record<ReviewReason, string> = {
  failed: "Failed",
  uncertain: "Uncertain",
  low_confidence: "Low confidence",
};

/** BR-020: the score is a band for prioritisation, not a probability. */
const formatConfidence = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);

type Props = {
  item: ReviewQueueItem;
  tz: string;
  selectable: boolean;
  selected: boolean;
  disabled: boolean;
  showReviewed: boolean;
  onToggle: (id: string, on: boolean) => void;
  onOpen: (id: string) => void;
};

/** One row of the review queue (UX §3.8). Click/Enter opens the slide-out; the checkbox only selects. */
export function ReviewRow({ item, tz, selectable, selected, disabled, showReviewed, onToggle, onOpen }: Props) {
  const a = item.analysis;
  return (
    <tr
      tabIndex={0}
      data-testid="review-row"
      aria-label={`Review item by ${item.username ?? "unknown"}`}
      onClick={() => onOpen(item.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen(item.id);
      }}
      className={cx(
        "cursor-pointer border-b border-secondary align-top outline-none hover:bg-primary_hover focus-visible:ring-2 focus-visible:ring-brand",
        selected && "bg-secondary",
      )}
    >
      {selectable ? (
        <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Checkbox
            aria-label={`Select item by ${item.username ?? "unknown"}`}
            isSelected={selected}
            isDisabled={disabled}
            onChange={(on) => onToggle(item.id, on)}
          />
        </td>
      ) : null}
      <td className="max-w-md px-3 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-secondary">{item.username ? `@${item.username}` : "—"}</span>
          <time
            dateTime={item.publishedAt}
            title={`${formatDateTime(item.publishedAt, tz)} (${tzLabel(tz)})`}
            className="text-tertiary"
          >
            {formatRelativeOrAbsolute(item.publishedAt, new Date(), tz)}
          </time>
          {a.hasOverride ? (
            <span title="Has an analyst override" className="text-tertiary">
              <Edit05 className="size-4" aria-label="Has override" />
            </span>
          ) : null}
        </div>
        <p className={cx("line-clamp-2 text-sm", item.text ? "text-primary" : "text-quaternary")}>
          {item.text ?? "No text"}
        </p>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {item.reasons.map((r) => (
            <Badge key={r} type="pill-color" color={r === "failed" ? "error" : "warning"} size="sm">
              {REASON_LABEL[r]}
            </Badge>
          ))}
        </div>
      </td>
      <td className="px-3 py-3">{a.relevance ? <RelevanceBadge value={a.relevance} /> : "—"}</td>
      <td className="px-3 py-3">{a.sentiment ? <SentimentBadge value={a.sentiment} /> : "—"}</td>
      <td className="px-3 py-3 text-sm whitespace-nowrap">
        <span title="Estimated model confidence — a band for prioritisation, not a probability">
          {formatConfidence(a.overallConfidence)}
        </span>
        {a.confidenceBand ? (
          <Badge type="modern" color="gray" size="sm" className="ml-1">
            {a.confidenceBand}
          </Badge>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <AnalysisStatusBadge value={a.status} />
        {a.status === "failed" && a.errorCode ? (
          <span className="mt-1 block font-mono text-xs text-error-primary">{a.errorCode}</span>
        ) : null}
      </td>
      {showReviewed ? (
        <td className="px-3 py-3 text-sm text-secondary">
          <span>{item.reviewedBy?.displayName ?? item.reviewedBy?.email ?? "—"}</span>
          {item.reviewedAt ? (
            <time dateTime={item.reviewedAt} className="block text-xs text-tertiary">
              {formatDateTime(item.reviewedAt, tz)}
            </time>
          ) : null}
        </td>
      ) : null}
    </tr>
  );
}
