"use client";

import { UuidSchema } from "@how-about-me/contracts";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef } from "react";

/** `?item` is the open slide-out on /mentions (UX §3.4, #326); anything but a UUID is ignored. */
export function parseMentionItem(search: URLSearchParams | null): string | null {
  const raw = search?.get("item");
  return raw && UuidSchema.safeParse(raw).success ? raw : null;
}

/** Query string without `item` — list filters only. */
export function withoutItem(qs: string): string {
  const next = new URLSearchParams(qs);
  next.delete("item");
  return next.toString();
}

/**
 * URL state for the mention slide-out (#326). Opening pushes so Back closes it; closing goes back when this
 * view pushed the entry (no duplicate list entry), otherwise (deep link `?item=`) replaces. Scroll is kept.
 */
export function useMentionItem() {
  const router = useRouter();
  const search = useSearchParams();
  const qs = search?.toString() ?? "";
  const item = useMemo(() => parseMentionItem(new URLSearchParams(qs)), [qs]);
  const pushedHere = useRef(false);

  const openItem = useCallback(
    (id: string) => {
      const next = new URLSearchParams(qs);
      next.set("item", id);
      pushedHere.current = true;
      router.push(`/mentions?${next.toString()}`, { scroll: false });
    },
    [qs, router],
  );

  const closeItem = useCallback(() => {
    if (pushedHere.current) {
      pushedHere.current = false;
      router.back();
      return;
    }
    const s = withoutItem(qs);
    router.replace(`/mentions${s ? `?${s}` : ""}`, { scroll: false });
  }, [qs, router]);

  const detailHref = useCallback(
    (id: string) => {
      const s = withoutItem(qs);
      return `/mentions/${id}${s ? `?${s}` : ""}`;
    },
    [qs],
  );

  return { item, openItem, closeItem, detailHref };
}
