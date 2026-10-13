"use client";

import { MentionsPageSchema, type MentionListItem, type MentionsPage } from "@how-about-me/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { qk, staleTimes } from "@/lib/query/keys";

export const MENTIONS_PAGE_SIZE = 25;

/**
 * GET /projects/:pid/mentions (FR-150..153). The cursor is opaque and lives in `pageParam` only — never in the
 * query key or the URL — so changing a filter resets the list. `count=true` only on the first page.
 */
export function useMentionsList(pid: string | null | undefined, params: Record<string, string>) {
  return useInfiniteQuery({
    queryKey: qk.mentions(pid ?? "", params),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      MentionsPageSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/mentions`, {
          params: {
            ...params,
            limit: String(MENTIONS_PAGE_SIZE),
            ...(pageParam ? { cursor: pageParam } : { count: "true" }),
          },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: staleTimes.mentions,
    enabled: !!pid,
  });
}

/** Rows can shift into the next page when new data lands between requests — keep the first occurrence (TC-MEN-003). */
export function flattenUnique(pages: readonly MentionsPage[]): MentionListItem[] {
  const seen = new Set<string>();
  const out: MentionListItem[] = [];
  for (const page of pages)
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  return out;
}
