/** Runs `fn` over `items` with at most `limit` in flight. `fn` must not throw (callers catch per item). */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++] as T;
      await fn(item);
    }
  };
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker());
  await Promise.all(workers);
}
