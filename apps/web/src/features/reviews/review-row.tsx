"use client";

import type { ReviewQueueItem } from "@how-about-me/contracts";
import { Edit05 } from "@untitledui/icons";
import type { KeyboardEvent, Ref } from "react";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { AnalysisStatusBadge, RelevanceBadge, SentimentBadge } from "@/features/shared/semantic-badge";
import { analysisErrorLabel } from "@/lib/semantics/analysis-errors";
import { formatDateTime, formatRelativeOrAbsolute, tzLabel } from "@/lib/time/format";
import { cx } from "@/utils/cx";
import { ConfidenceCell, ReasonBadges } from "./review-cells";

type Props = {
  item: ReviewQueueItem;
  tz: string;
  selectable: boolean;
  selected: boolean;
  disabled: boolean;
  showReviewed: boolean;
  onToggle: (id: string, on: boolean) => void;
  onOpen: (id: string) => void;
  /** Roving focus / Enter / Space handler from `useRovingRows` (#339). */
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  ref?: Ref<HTMLTableRowElement>;
};

/** One row of the review queue (UX §3.8). Click/Enter opens, Space selects, ↑/↓ move (#339). */
export function ReviewRow({
  item,
  tz,
  selectable,
  selected,
  disabled,
  showReviewed,
  onToggle,
  onOpen,
  onKeyDown,
  ref,
}: Props) {
  const a = item.analysis;
  return (
    <tr
      ref={ref}
      tabIndex={0}
      data-testid="review-row"
      aria-label={`Mục cần xem lại của @${item.username ?? "không rõ"}`}
      onClick={() => onOpen(item.id)}
      onKeyDown={onKeyDown}
      className={cx(
        "cursor-pointer border-b border-secondary align-top outline-none hover:bg-primary_hover focus-visible:ring-2 focus-visible:ring-brand",
        selected && "bg-secondary",
      )}
    >
      {selectable ? (
        <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Checkbox
            aria-label={`Chọn mục của @${item.username ?? "không rõ"}`}
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
            <span title="Đã có chỉnh sửa của chuyên viên" className="text-tertiary">
              <Edit05 className="size-4" aria-label="Đã chỉnh sửa" />
            </span>
          ) : null}
        </div>
        <p className={cx("line-clamp-2 text-sm", item.text ? "text-primary" : "text-quaternary")}>
          {item.text ?? "Không có nội dung"}
        </p>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          <ReasonBadges reasons={item.reasons} />
        </div>
      </td>
      {/* #338: values on a failed item come from the previous completed run. */}
      <td className="px-3 py-3">
        {a.relevance ? (
          <>
            {a.status === "failed" ? <span className="block text-xs text-tertiary">Lần trước:</span> : null}
            <RelevanceBadge value={a.relevance} />
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-3">
        {a.sentiment ? (
          <>
            {a.status === "failed" ? <span className="block text-xs text-tertiary">Lần trước:</span> : null}
            <SentimentBadge value={a.sentiment} />
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-3 text-sm whitespace-nowrap">
        {/* BR-020: the score is a band for prioritisation, not a probability. */}
        <ConfidenceCell analysis={a} />
      </td>
      <td className="px-3 py-3">
        <AnalysisStatusBadge value={a.status} />
        {a.status === "failed" && a.errorCode ? (
          <span className="mt-1 block text-xs text-error-primary" title={a.errorCode}>
            {analysisErrorLabel(a.errorCode)}
          </span>
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
