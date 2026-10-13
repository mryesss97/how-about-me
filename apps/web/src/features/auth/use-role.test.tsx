import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT_STORAGE_KEY } from "./use-current-project";
import { useRole } from "./use-role";
import { meFixture, P1, P2, projectFixture, Providers } from "./test-utils";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class extends Error {},
}));

beforeEach(() => {
  window.localStorage.clear();
  apiFetch.mockReset();
});

// FR-018: role comes from the current project's membership.
describe("useRole", () => {
  it("uses the stored current project", async () => {
    window.localStorage.setItem(PROJECT_STORAGE_KEY, P2);
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "admin"), projectFixture(P2, "viewer")]));
    const { result } = renderHook(() => useRole(), { wrapper: Providers });
    await waitFor(() => expect(result.current.role).toBe("viewer"));
  });

  it("falls back to projects[0] when the stored id is no longer a membership", async () => {
    window.localStorage.setItem(PROJECT_STORAGE_KEY, "gone");
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "analyst")]));
    const { result } = renderHook(() => useRole(), { wrapper: Providers });
    await waitFor(() => expect(result.current.role).toBe("analyst"));
    expect(result.current.hasRole(["admin"])).toBe(false);
  });

  it("returns null role when the user has no project", async () => {
    apiFetch.mockResolvedValue(meFixture([]));
    const { result } = renderHook(() => useRole(), { wrapper: Providers });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.role).toBeNull();
    expect(result.current.hasProject).toBe(false);
  });
});
