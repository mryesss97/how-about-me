import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False on the server and during hydration, true afterwards. Gate UI derived from client-only query cache
 * (e.g. the `/me` role) with it: TanStack Query may already hold data when a Suspense boundary hydrates,
 * which would otherwise render markup the server never sent (hydration mismatch).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
