"use client";

import type { MentionDetail } from "@how-about-me/contracts";
import Link from "next/link";
import { reviewReasonLabelVi } from "@/lib/semantics/labels";

/**
 * #339 (UX §3.4): "Đang chờ xem lại · <lý do>" + link to the queue when the post waits for review
 * (FR-195; `status` computed server-side per BR-040). Nothing when reviewed, out of scope or field absent.
 */
export function ReviewNote({ mentionId, review }: { mentionId: string; review: MentionDetail["review"] }) {
  if (!review || review.status !== "unreviewed") return null;
  // #390: carry the first reason so the queue opens on a narrow tab where the item is likely on page 1.
  const qs = new URLSearchParams();
  if (review.reasons[0]) qs.set("reason", review.reasons[0]);
  qs.set("item", mentionId);
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm text-secondary">
      <span>Đang chờ xem lại · {review.reasons.map((r) => reviewReasonLabelVi[r]).join(", ")}</span>
      <Link
        href={`/reviews?${qs.toString()}`}
        className="font-semibold text-[var(--ink)] underline-offset-2 hover:underline"
      >
        Mở trong Cần xem lại
      </Link>
    </p>
  );
}
