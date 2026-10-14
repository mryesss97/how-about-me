"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/base/buttons/button";
import { DetailSlideout } from "@/features/shared/detail-slideout";
import { useMarkReviewed } from "./api";

/** Detail body for one reviewed post; injected by the route (`app/(app)/reviews`) so features stay decoupled (#233). */
export type RenderReviewDetail = (postId: string) => ReactNode;

/** Review slide-out (#219): mention detail (with override form, T-143) + "Mark reviewed" for one item. */
export function ReviewDetailSlideout({
  pid,
  postId,
  canMark,
  onClose,
  renderDetail,
}: {
  pid: string;
  postId: string;
  /** Admin/analyst on the unreviewed queue only. */
  canMark: boolean;
  onClose: () => void;
  renderDetail: RenderReviewDetail;
}) {
  const mark = useMarkReviewed(pid);
  return (
    <DetailSlideout
      key={postId}
      title="Chi tiết bài viết"
      regionLabel="Chi tiết bài viết"
      onClose={onClose}
      fullPageHref={() => `/mentions/${postId}`}
      fallbackHref="/mentions"
      actions={
        // Keep the button (disabled) while pending: the optimistic remove drops the row, which flips `canMark`.
        canMark || mark.isPending ? (
          <Button
            size="sm"
            isDisabled={mark.isPending}
            isLoading={mark.isPending}
            onClick={() => mark.mutate([postId], { onSuccess: onClose })}
          >
            Đánh dấu đã xem lại
          </Button>
        ) : null
      }
    >
      {renderDetail(postId)}
    </DetailSlideout>
  );
}
