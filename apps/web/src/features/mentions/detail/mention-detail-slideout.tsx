"use client";

import type { ReactNode } from "react";
import { DetailSlideout } from "@/features/shared/detail-slideout";
import { MentionDetail } from "./mention-detail";

/**
 * Slide-out opened from the Mentions list via the intercepting route `@detail/(.)[id]` (UX §3.4, TC-MEN-009).
 * Esc / close → back to the list with its filters; React Aria returns focus to the row that opened it.
 */
export function MentionDetailSlideout({
  mentionId,
  onClose,
  fullPageHref,
  actions,
}: {
  mentionId: string;
  /** Overrides the default close (history back → /mentions). */
  onClose?: () => void;
  fullPageHref?: string;
  /** Extra controls rendered in the header. */
  actions?: ReactNode;
}) {
  return (
    <DetailSlideout
      title="Chi tiết bài nhắc"
      regionLabel="Chi tiết bài nhắc"
      fullPageHref={(qs) => fullPageHref ?? `/mentions/${mentionId}${qs ? `?${qs}` : ""}`}
      fallbackHref="/mentions"
      onClose={onClose}
      actions={actions}
    >
      <MentionDetail mentionId={mentionId} variant="slideout" />
    </DetailSlideout>
  );
}
