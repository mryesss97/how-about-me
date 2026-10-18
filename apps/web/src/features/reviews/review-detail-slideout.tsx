"use client";

import type { ReviewQueueItem } from "@how-about-me/contracts";
import { Fragment, type ReactNode } from "react";
import { Button } from "@/components/base/buttons/button";
import { DetailSlideout, type DetailSlideoutNav } from "@/features/shared/detail-slideout";
import { formatRate } from "@/lib/format/number";
import { withBack } from "@/lib/navigation/back-link";
import { useMarkReviewed } from "./api";
import { ReasonBadges } from "./review-cells";

/** Hooks the Reviews slide-out offers to the injected detail body (#339). */
export type ReviewDetailContext = {
  /** Present for admin/analyst on the unreviewed queue: after an override is saved, optionally mark-and-next. */
  onOverrideSaved?: (markReviewed: boolean) => void;
};

/** Detail body for one reviewed post; injected by the route (`app/(app)/reviews`) so features stay decoupled (#233). */
export type RenderReviewDetail = (postId: string, ctx: ReviewDetailContext) => ReactNode;

export type ReviewNav = DetailSlideoutNav & {
  /** Resolves the id to show after the current one (may load the next page); null = none. */
  resolveNext: () => Promise<string | null>;
};

/** Query string of the list without `item` → the full page's back link returns to the same tab (#331, #339). */
function backToQueue(qs: string): string {
  const next = new URLSearchParams(qs);
  next.delete("item");
  const s = next.toString();
  return `/reviews${s ? `?${s}` : ""}`;
}

/**
 * Review slide-out (#219, #339): mention detail (override form, T-143) with ‹ n / N › + J/K, the item's reasons
 * under the title, and "Đánh dấu đã xem lại · tiếp" in the footer (marks one id, BR-040, then opens the next;
 * closes on the last). The frame is not keyed by item — only the body — so moving never remounts the panel.
 */
export function ReviewDetailSlideout({
  pid,
  postId,
  item,
  canMark,
  nav,
  isCurrent,
  onMove,
  onClose,
  renderDetail,
}: {
  pid: string;
  postId: string;
  /** Queue row of the open item (undefined for a deep link outside the loaded tab). */
  item: ReviewQueueItem | undefined;
  /** Admin/analyst on the unreviewed queue only (FR-015). */
  canMark: boolean;
  nav: ReviewNav | undefined;
  /** Whether `id` is still the open item — guards a late `onSuccess` after the user moved on. */
  isCurrent: (id: string) => boolean;
  onMove: (id: string) => void;
  onClose: () => void;
  renderDetail: RenderReviewDetail;
}) {
  const mark = useMarkReviewed(pid);
  const hasNext = nav ? !nav.nextDisabled : false;

  const markAndNext = (id: string) => {
    mark.mutate([id], {
      onSuccess: async () => {
        if (!isCurrent(id)) return;
        const target = nav ? await nav.resolveNext() : null;
        if (!isCurrent(id)) return;
        if (target) onMove(target);
        else onClose();
      },
    });
  };

  const reasons = item ? (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <ReasonBadges reasons={item.reasons} />
      {item.reasons.includes("low_confidence") && item.analysis.overallConfidence != null ? (
        <span className="text-secondary tabular-nums">{formatRate(item.analysis.overallConfidence)}</span>
      ) : null}
    </div>
  ) : null;

  const ctx: ReviewDetailContext = canMark ? { onOverrideSaved: (on) => on && markAndNext(postId) } : {};

  return (
    <DetailSlideout
      title="Chi tiết bài nhắc"
      regionLabel="Chi tiết bài nhắc"
      onClose={onClose}
      fullPageHref={(qs) => withBack(`/mentions/${postId}`, backToQueue(qs))}
      fallbackHref="/reviews"
      nav={nav}
      itemKey={postId}
      subheader={reasons}
      footer={
        // Keep the button (disabled) while pending: the optimistic remove drops the row, which flips `canMark`.
        canMark || mark.isPending ? (
          <Button
            className="min-h-11 w-full md:min-h-0 md:w-auto"
            isDisabled={mark.isPending}
            isLoading={mark.isPending}
            onClick={() => markAndNext(postId)}
          >
            {hasNext ? "Đánh dấu đã xem lại · tiếp" : "Đánh dấu đã xem lại"}
          </Button>
        ) : null
      }
    >
      <Fragment key={postId}>{renderDetail(postId, ctx)}</Fragment>
    </DetailSlideout>
  );
}
