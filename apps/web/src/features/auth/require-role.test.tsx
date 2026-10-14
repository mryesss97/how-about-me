import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequireRole } from "./require-role";
import { meFixture, P1, projectFixture, Providers } from "./test-utils";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class extends Error {},
}));

beforeEach(() => {
  apiFetch.mockReset();
});

const renderGuard = (fallback?: null) =>
  render(
    <Providers>
      <RequireRole roles={["admin", "analyst"]} {...(fallback === null ? { fallback: null } : {})}>
        <p>secret content</p>
      </RequireRole>
    </Providers>,
  );

// FR-018, BR-033 — UX gating; server enforces (FR-015).
describe("RequireRole", () => {
  it("renders children for an allowed role", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "analyst")]));
    renderGuard();
    expect(await screen.findByText("secret content")).toBeInTheDocument();
  });

  it("shows the Forbidden page with a back link for a denied role (TC-AUTH-015)", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "viewer")]));
    renderGuard();
    expect(await screen.findByText("Bạn không có quyền xem trang này.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /về tổng quan/i })).toHaveAttribute("href", "/overview");
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("renders nothing when fallback is null", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "viewer")]));
    const { container } = renderGuard(null);
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("does not flash forbidden while /me loads", () => {
    apiFetch.mockReturnValue(new Promise(() => {}));
    renderGuard();
    expect(screen.queryByText(/permission/)).not.toBeInTheDocument();
    expect(screen.getByText("Đang tải…")).toBeInTheDocument();
  });

  it("shows an error state when /me fails", async () => {
    apiFetch.mockRejectedValue(new Error("boom"));
    renderGuard();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("shows a no-project state for non-members", async () => {
    apiFetch.mockResolvedValue(meFixture([]));
    renderGuard();
    expect(await screen.findByText("Bạn chưa thuộc dự án nào.")).toBeInTheDocument();
  });
});
