"use client";

import { useCallback, useRef, type KeyboardEvent } from "react";

/**
 * Roving focus over a list of rows/cards (#339, same pattern as `mentions-list.tsx`): ↑/↓ move focus,
 * Enter opens, Space toggles the selection when `onToggle` is given. Only handles keys on the row itself.
 */
export function useRovingRows() {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const setRef = useCallback(
    (i: number) => (el: HTMLElement | null) => {
      refs.current[i] = el;
    },
    [],
  );
  const onKey = useCallback(
    (i: number, onOpen: () => void, onToggle?: () => void) => (e: KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        refs.current[e.key === "ArrowDown" ? i + 1 : i - 1]?.focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onOpen();
      } else if (e.key === " ") {
        e.preventDefault();
        onToggle?.();
      }
    },
    [],
  );
  return { setRef, onKey };
}
