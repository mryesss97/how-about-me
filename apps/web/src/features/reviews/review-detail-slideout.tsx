"use client";

import { Button } from "@/components/base/buttons/button";
import { MentionDetailSlideout } from "@/features/mentions/detail/mention-detail-slideout";
import { useMarkReviewed } from "./api";

/** Review slide-out (#219): mention detail (with override form, T-143) + "Mark reviewed" for one item. */
export function ReviewDetailSlideout({
  pid,
  postId,
  canMark,
  onClose,
}: {
  pid: string;
  postId: string;
  /** Admin/analyst on the unreviewed queue only. */
  canMark: boolean;
  onClose: () => void;
}) {
  const mark = useMarkReviewed(pid);
  return (
    <MentionDetailSlideout
      key={postId}
      mentionId={postId}
      onClose={onClose}
      fullPageHref={`/mentions/${postId}`}
      actions={
        // Keep the button (disabled) while pending: the optimistic remove drops the row, which flips `canMark`.
        canMark || mark.isPending ? (
          <Button
            size="sm"
            isDisabled={mark.isPending}
            isLoading={mark.isPending}
            onClick={() => mark.mutate([postId], { onSuccess: onClose })}
          >
            Mark reviewed
          </Button>
        ) : null
      }
    />
  );
}
