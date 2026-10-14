import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequireProject } from "./require-project";
import { meFixture, P1, projectFixture, Providers } from "./test-utils";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class extends Error {},
}));

beforeEach(() => {
  apiFetch.mockReset();
});

const renderGate = () =>
  render(
    <Providers>
      <RequireProject>
        <p>page content</p>
      </RequireProject>
    </Providers>,
  );

// FR-018 — a signed-in user with no membership sees an explicit state, not empty dashboards.
describe("RequireProject", () => {
  it("renders the page for a member", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "viewer")]));
    renderGate();
    expect(await screen.findByText("page content")).toBeInTheDocument();
  });

  it("shows the no-project state when the user has no membership", async () => {
    apiFetch.mockResolvedValue(meFixture([]));
    renderGate();
    expect(await screen.findByText("Bạn chưa thuộc dự án nào.")).toBeInTheDocument();
    expect(screen.queryByText("page content")).not.toBeInTheDocument();
  });

  it("keeps the page while /me loads or fails", async () => {
    apiFetch.mockRejectedValue(new Error("boom"));
    renderGate();
    expect(screen.getByText("page content")).toBeInTheDocument();
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(screen.getByText("page content")).toBeInTheDocument();
  });
});
