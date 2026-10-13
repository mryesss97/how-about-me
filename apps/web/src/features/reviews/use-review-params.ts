"use client";

import { ReviewReasonSchema, type ReviewReason, type ReviewStatus } from "@how-about-me/contracts";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export type ReviewParams = { reason?: ReviewReason; status: ReviewStatus; item: string | null };

/** `?reason` (missing/invalid → All), `?status=reviewed` (default unreviewed), `?item` = open slide-out. */
export function parseReviewParams(search: URLSearchParams | null): ReviewParams {
  const reason = ReviewReasonSchema.safeParse(search?.get("reason"));
  return {
    reason: reason.success ? reason.data : undefined,
    status: search?.get("status") === "reviewed" ? "reviewed" : "unreviewed",
    item: search?.get("item") || null,
  };
}

/** URL state for /reviews (UX §3.8). Tabs/toggle replace history; opening an item pushes so Back closes it. */
export function useReviewParams() {
  const router = useRouter();
  const search = useSearchParams();
  const qs = search?.toString() ?? "";
  const params = useMemo(() => parseReviewParams(new URLSearchParams(qs)), [qs]);

  const go = useCallback(
    (patch: Record<string, string | null>, mode: "push" | "replace") => {
      const next = new URLSearchParams(qs);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      const s = next.toString();
      router[mode](`/reviews${s ? `?${s}` : ""}`);
    },
    [qs, router],
  );

  return {
    ...params,
    setReason: useCallback((r: ReviewReason | null) => go({ reason: r, item: null }, "replace"), [go]),
    setShowReviewed: useCallback((on: boolean) => go({ status: on ? "reviewed" : null, item: null }, "replace"), [go]),
    openItem: useCallback((id: string) => go({ item: id }, "push"), [go]),
    closeItem: useCallback(() => go({ item: null }, "replace"), [go]),
  };
}
