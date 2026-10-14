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
    expect(await screen.findAllByText("Chỉ xem")).not.toHaveLength(0);
    // #219: Reviews is open to every role (viewer reads only). #274: Vietnamese shell.
    for (const label of ["Tổng quan", "Bài nhắc", "Cần xem lại", "Truy vấn theo dõi", "Trạng thái hệ thống"])
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Project")).not.toBeInTheDocument();
  });

  it("shows the project switcher with ≥ 2 projects", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "admin"), projectFixture(P2, "viewer")]));
    render(<AppSidebar />, { wrapper: Providers });
    expect((await screen.findAllByText("Quản trị")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("P 11111111-1111-4111-8111-111111111111").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Project").length).toBeGreaterThan(0);
  });

  it("#262: the logo links to the landing page /", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "viewer")]));
    render(<AppSidebar />, { wrapper: Providers });
    const links = await screen.findAllByRole("link", { name: "How About Me — trang chủ" });
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l).toHaveAttribute("href", "/");
  });

  it("#274: Vietnamese sign-out on the sky sign", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "viewer")]));
    render(<AppSidebar />, { wrapper: Providers });
    expect((await screen.findAllByRole("button", { name: "Đăng xuất" })).length).toBeGreaterThan(0);
  });
});
