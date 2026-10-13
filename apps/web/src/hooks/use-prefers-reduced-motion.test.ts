import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

afterEach(() => vi.unstubAllGlobals());

/** #222 — NFR-031: reduced motion follows the OS setting and its change events. */
describe("usePrefersReducedMotion (#222)", () => {
  it("tracks matchMedia changes", () => {
    let listener: () => void = () => {};
    const mql = {
      matches: false,
      addEventListener: (_: string, cb: () => void) => (listener = cb),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => mql),
    );
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    mql.matches = true;
    act(() => listener());
    expect(result.current).toBe(true);
  });
});
