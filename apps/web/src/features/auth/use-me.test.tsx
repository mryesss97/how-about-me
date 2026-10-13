import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useMe } from "./use-me";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useMe", () => {
  it("parses /me (non-member with empty projects does not crash)", async () => {
    apiFetch.mockResolvedValue({
      id: "7f1c5a3e-2b4d-4c6e-8f9a-0b1c2d3e4f50",
      email: "a@b.co",
      displayName: null,
      projects: [],
    });
    const { result } = renderHook(() => useMe(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetch).toHaveBeenCalledWith("/me");
    expect(result.current.data?.projects).toEqual([]);
  });

  it("errors on a response that does not match MeResponseSchema", async () => {
    apiFetch.mockResolvedValue({ id: "x" });
    const { result } = renderHook(() => useMe(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
