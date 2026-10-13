import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type * as ClientModule from "@/lib/api/client";
import { canOverride, canReanalyze, useCreateOverride } from "./api";

const apiFetchMock = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetchMock(...a),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const PID = "11111111-1111-4111-8111-111111111111";
const MID = "00000000-0000-4000-8000-000000000001";
const overrideResponse = {
  id: "00000000-0000-4000-8000-000000000002",
  field: "relevance",
  previousValue: "uncertain",
  value: "relevant",
  reason: "checked",
  reviewedBy: null,
  createdAt: "2026-10-13T03:00:00.000Z",
  revokedAt: null,
};

// FR-155 / BR-033: FE gating mirrors the server rule.
describe("canReanalyze (BR-033)", () => {
  it("admin always", () => {
    expect(canReanalyze("admin", { allowAnalystReanalyze: false })).toBe(true);
    expect(canReanalyze("admin", null)).toBe(true);
  });
  it("analyst only when the project setting allows it", () => {
    expect(canReanalyze("analyst", { allowAnalystReanalyze: true })).toBe(true);
    expect(canReanalyze("analyst", { allowAnalystReanalyze: false })).toBe(false);
    expect(canReanalyze("analyst", null)).toBe(false);
  });
  it("viewer and no role never", () => {
    expect(canReanalyze("viewer", { allowAnalystReanalyze: true })).toBe(false);
    expect(canReanalyze(null, { allowAnalystReanalyze: true })).toBe(false);
  });
});

// FR-191 / FR-015: only admin and analyst see override controls; the server enforces it too.
describe("canOverride (FR-191)", () => {
  it("admin and analyst", () => {
    expect(canOverride("admin")).toBe(true);
    expect(canOverride("analyst")).toBe(true);
  });
  it("viewer and no role never", () => {
    expect(canOverride("viewer")).toBe(false);
    expect(canOverride(null)).toBe(false);
  });
});

// #219 / FR-195: an override can move the item between review tabs → the review queue goes stale.
describe("useCreateOverride invalidation", () => {
  it("invalidates ['project', pid, 'reviews'] on success", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");
    apiFetchMock.mockResolvedValueOnce(overrideResponse);
    const { result } = renderHook(() => useCreateOverride(PID, MID), {
      wrapper: ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children),
    });
    result.current.mutate({ field: "relevance", value: "relevant", reason: "checked" });
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ["project", PID, "reviews"] }));
  });
});
