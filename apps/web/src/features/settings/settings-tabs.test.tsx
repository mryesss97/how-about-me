import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { meFixture, P1, projectFixture, Providers } from "@/features/auth/test-utils";
import { useRole } from "@/features/auth/use-role";
import { SettingsTabs } from "./settings-tabs";

const apiFetch = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/settings/members" }));
vi.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

/** Renders the loaded role so tests can wait for `/me` instead of sleeping. */
function RoleProbe() {
  return <span data-testid="role">{useRole().role ?? ""}</span>;
}
const renderTabs = () =>
  render(
    <>
      <SettingsTabs />
      <RoleProbe />
    </>,
    { wrapper: Providers },
  );

// FR-018, TC-AUTH-014
describe("SettingsTabs", () => {
  it("hides Members and Integrations from a viewer", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "viewer")]));
    renderTabs();
    await waitFor(() => expect(screen.getByTestId("role")).toHaveTextContent("viewer"));
    expect(screen.getByRole("link", { name: "Project" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Integrations" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Members" })).not.toBeInTheDocument();
  });

  it("shows every tab to an admin", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "admin")]));
    renderTabs();
    expect(await screen.findByRole("link", { name: "Members" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Integrations" })).toBeInTheDocument();
  });

  it("marks the tab for the current path as active", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "admin")]));
    renderTabs();
    expect(await screen.findByRole("link", { name: "Members" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Project" })).not.toHaveAttribute("aria-current");
  });

  it.each(["admin", "analyst", "viewer"] as const)("FR-190: %s sees the Analysis tab", async (role) => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, role)]));
    renderTabs();
    await waitFor(() => expect(screen.getByTestId("role")).toHaveTextContent(role));
    expect(screen.getByRole("link", { name: "Analysis" })).toBeInTheDocument();
  });
});
