/** Position of the open item in the loaded queue (#339). `index` null = current is not (or no longer) listed. */
export type QueueNeighbours = { index: number | null; prevId: string | null; nextId: string | null };

/**
 * Prev/next around `current` (#339). When `current` disappeared from `ids` (optimistic remove after marking, or an
 * override took it out of the queue), `lastIndex` — where it used to be — picks the neighbours: the item that slid
 * into its place is next. Never seen in the list (deep link outside the tab) → no navigation.
 */
export function queueNeighbours(ids: readonly string[], current: string, lastIndex: number | null): QueueNeighbours {
  const i = ids.indexOf(current);
  if (i >= 0) return { index: i, prevId: ids[i - 1] ?? null, nextId: ids[i + 1] ?? null };
  if (lastIndex === null) return { index: null, prevId: null, nextId: null };
  return { index: null, prevId: ids[lastIndex - 1] ?? null, nextId: ids[lastIndex] ?? null };
}
