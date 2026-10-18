"use client";

import type { ReactNode } from "react";
import { DetailSlideout } from "@/features/shared/detail-slideout";
import { MentionDetail } from "./mention-detail";

/**
 * Slide-out opened over the Mentions list via `?item=<id>` (UX §3.4, TC-MEN-009, #326).
 * Esc / close → `onClose` clears `item`; the list never unmounts, so React Aria returns focus to the row link.
 */
export function MentionDetailSlideout({
  mentionId,
  onClose,
  fullPageHref,
  actions,
}: {
  mentionId: string;
  /** Clears `?item` (history back or replace). */
  onClose: () => void;
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
