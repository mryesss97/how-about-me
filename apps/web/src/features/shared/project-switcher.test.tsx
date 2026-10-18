import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { meFixture, P1, P2, projectFixture, Providers } from "@/features/auth/test-utils";
import { PROJECT_STORAGE_KEY } from "@/features/auth/use-current-project";
import { routeAfterProjectSwitch, ShellProject } from "./project-switcher";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
const replace = vi.fn();
let pathname = "/overview";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ replace }) }));

beforeEach(() => {
  apiFetch.mockReset();
  replace.mockReset();
  pathname = "/overview";
  window.localStorage.clear();
});

// #348, UX §1, FR-036, TC-PROJ-012
describe("ShellProject", () => {
  it("renders nothing without a project", async () => {
    apiFetch.mockResolvedValue(meFixture([]));
    const { container } = render(<ShellProject />, { wrapper: Providers });
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the project name with a 'Dự án' label for a single project (any role)", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "viewer", "Thương hiệu A")]));
    render(<ShellProject />, { wrapper: Providers });
    expect(await screen.findByText("Thương hiệu A")).toHaveAttribute("title", "Thương hiệu A");
    expect(screen.getByText("Dự án")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("with ≥ 2 projects it is a labelled select; switching keeps the route and drops filters", async () => {
    pathname = "/mentions";
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "admin", "Alpha"), projectFixture(P2, "viewer", "Beta")]));
    render(<ShellProject />, { wrapper: Providers });
    const trigger = await screen.findByRole("button", { name: /Dự án/ });
    expect(trigger).toHaveTextContent("Alpha");
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("option", { name: "Beta" }));
    expect(window.localStorage.getItem(PROJECT_STORAGE_KEY)).toBe(P2);
    expect(replace).toHaveBeenCalledWith("/mentions");
  });

  it("detail routes of the old project go to their parent", () => {
    expect(routeAfterProjectSwitch("/mentions/abc")).toBe("/mentions");
    expect(routeAfterProjectSwitch("/terms/giá")).toBe("/overview");
    expect(routeAfterProjectSwitch("/settings/members")).toBe("/settings/members");
  });
});
