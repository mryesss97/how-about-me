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
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  ref?: Ref<HTMLElement>;
};

/**
 * Review queue card below `md` (#339, UX §3.8 Mobile) — same shape as the mention card (#337).
 * The whole card opens the slide-out; the checkbox has a 44×44 hit area and only selects.
 */
export function ReviewCard({
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
  const who = item.username ? `@${item.username}` : "không rõ";
  return (
    // A focusable article, not role="button": it contains the checkbox (no nested interactive, axe).
    <article
      ref={ref}
      tabIndex={0}
      data-testid="review-card"
      aria-label={`Mục cần xem lại của ${who}`}
      onClick={() => onOpen(item.id)}
      onKeyDown={onKeyDown}
      className={cx(
        "flex cursor-pointer flex-col gap-2 rounded-xl border border-secondary bg-primary p-4 outline-none focus-visible:ring-2 focus-visible:ring-brand",
        selected && "bg-secondary",
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        {selectable ? (
          <div
            className="-m-3 inline-flex size-11 shrink-0 items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Checkbox
              aria-label={`Chọn mục của ${who}`}
              isSelected={selected}
              isDisabled={disabled}
              onChange={(on) => onToggle(item.id, on)}
            />
          </div>
        ) : null}
        <span className="text-secondary">{item.username ? `@${item.username}` : "—"}</span>
        <span aria-hidden className="text-tertiary">
          ·
        </span>
        <time
          dateTime={item.publishedAt}
          title={`${formatDateTime(item.publishedAt, tz)} (${tzLabel(tz)})`}
          className="text-tertiary"
        >
          {formatRelativeOrAbsolute(item.publishedAt, new Date(), tz)}
        </time>
        {a.hasOverride ? (
          <span title="Có ghi đè của chuyên viên" className="text-tertiary">
            <Edit05 className="size-4" aria-label="Có ghi đè" />
          </span>
        ) : null}
      </div>
      <p className={cx("line-clamp-3 text-sm", item.text ? "text-primary" : "text-quaternary")}>
        {item.text ?? "Không có nội dung"}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <ReasonBadges reasons={item.reasons} />
        {/* #338: values on a failed item come from the previous completed run. */}
        {a.status === "failed" && (a.relevance || a.sentiment) ? (
          <span className="text-xs text-tertiary">Lần trước:</span>
        ) : null}
        {a.relevance ? <RelevanceBadge value={a.relevance} /> : null}
        {a.sentiment ? <SentimentBadge value={a.sentiment} /> : null}
        <ConfidenceCell analysis={a} />
        {a.status !== "completed" ? <AnalysisStatusBadge value={a.status} /> : null}
        {a.status === "failed" && a.errorCode ? (
          <span className="text-xs text-error-primary" title={a.errorCode}>
            {analysisErrorLabel(a.errorCode)}
          </span>
        ) : null}
      </div>
      {showReviewed ? (
        <p className="text-xs text-tertiary">
          Xem lại bởi {item.reviewedBy?.displayName ?? item.reviewedBy?.email ?? "—"}
          {item.reviewedAt ? ` · ${formatDateTime(item.reviewedAt, tz)}` : ""}
        </p>
      ) : null}
    </article>
  );
}
