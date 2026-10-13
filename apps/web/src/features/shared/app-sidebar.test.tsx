import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { meFixture, P1, P2, projectFixture, Providers } from "@/features/auth/test-utils";
import { AppSidebar } from "./app-sidebar";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/overview", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/auth/use-sign-out", () => ({ useSignOut: () => vi.fn() }));

// FR-018, FR-036
describe("AppSidebar", () => {
  it("shows the shared nav to a viewer with role badge and no switcher for 1 project (TC-AUTH-014, TC-PROJ-012)", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "viewer")]));
    render(<AppSidebar />, { wrapper: Providers });
    expect(await screen.findAllByText("viewer")).not.toHaveLength(0);
    // #219: Reviews is open to every role (viewer reads only).
    for (const label of ["Overview", "Mentions", "Reviews", "Listening Queries", "System Status"])
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Project")).not.toBeInTheDocument();
  });

  it("shows the project switcher with ≥ 2 projects", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "admin"), projectFixture(P2, "viewer")]));
    render(<AppSidebar />, { wrapper: Providers });
    expect((await screen.findAllByText("admin")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("P 11111111-1111-4111-8111-111111111111").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Project").length).toBeGreaterThan(0);
  });
});
