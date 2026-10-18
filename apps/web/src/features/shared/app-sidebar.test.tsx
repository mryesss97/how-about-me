import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { meFixture, P1, P2, projectFixture, Providers } from "@/features/auth/test-utils";
import { AppSidebar, resolveActiveHref } from "./app-sidebar";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
let pathname = "/overview";
let search = "";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/features/auth/use-sign-out", () => ({ useSignOut: () => vi.fn() }));

// FR-018, FR-036
describe("AppSidebar", () => {
  beforeEach(() => {
    pathname = "/overview";
    search = "";
  });

  it("shows the shared nav to a viewer with role badge and no switcher for 1 project (TC-AUTH-014, TC-PROJ-012)", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "viewer")]));
    render(<AppSidebar />, { wrapper: Providers });
    expect(await screen.findAllByText("Chỉ xem")).not.toHaveLength(0);
    // #219: Reviews is open to every role (viewer reads only). #274: Vietnamese shell.
    for (const label of ["Tổng quan", "Bài nhắc", "Cần xem lại", "Truy vấn theo dõi", "Trạng thái hệ thống"])
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Dự án")).not.toBeInTheDocument();
  });

  it("shows the project switcher with ≥ 2 projects", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "admin"), projectFixture(P2, "viewer")]));
    render(<AppSidebar />, { wrapper: Providers });
    expect((await screen.findAllByText("Quản trị")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("P 11111111-1111-4111-8111-111111111111").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Dự án").length).toBeGreaterThan(0);
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

// #325, BR-017: exactly one current item per rendered sidebar (content renders in drawer + desktop).
function currentLabels(): string[] {
  return screen
    .getAllByRole("link", { hidden: true })
    .filter((a) => a.getAttribute("aria-current") === "page")
    .map((a) => a.textContent?.trim() ?? "");
}

describe("AppSidebar current item (#325, BR-017)", () => {
  it("moves the plate when the pathname changes", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "admin")]));
    pathname = "/overview";
    const { rerender } = render(<AppSidebar />, { wrapper: Providers });
    await screen.findAllByText("Quản trị");
    expect(new Set(currentLabels())).toEqual(new Set(["Tổng quan"]));
    pathname = "/reviews";
    rerender(<AppSidebar />);
    const labels = currentLabels();
    expect(new Set(labels)).toEqual(new Set(["Cần xem lại"]));
    expect(labels.length).toBeLessThanOrEqual(2);
  });

  it.each(["/settings/members", "/settings/integrations", "/settings/analysis", "/settings/project"])(
    "marks Cài đặt current on %s",
    async (p) => {
      apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "admin")]));
      pathname = p;
      render(<AppSidebar />, { wrapper: Providers });
      await screen.findAllByText("Quản trị");
      expect(await screen.findAllByRole("link", { name: /Cài đặt/, hidden: true })).not.toHaveLength(0);
      expect(new Set(currentLabels())).toEqual(new Set(["Cài đặt"]));
    },
  );

  it("marks Bài nhắc current on a mention detail", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "viewer")]));
    pathname = "/mentions/abc";
    render(<AppSidebar />, { wrapper: Providers });
    await screen.findAllByText("Chỉ xem");
    expect(new Set(currentLabels())).toEqual(new Set(["Bài nhắc"]));
  });

  it("marks nothing current on an unknown path", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "viewer")]));
    pathname = "/foo";
    render(<AppSidebar />, { wrapper: Providers });
    await screen.findAllByText("Chỉ xem");
    expect(currentLabels()).toEqual([]);
  });
});

describe("resolveActiveHref (#325)", () => {
  const list = [
    { label: "A", href: "/mentions" },
    { label: "B", href: "/mentions/saved" },
    { label: "S", href: "/settings/project", match: "/settings" },
  ];
  it("picks the longest segment-aligned prefix", () => {
    expect(resolveActiveHref("/mentions/saved/1", list)).toBe("/mentions/saved");
    expect(resolveActiveHref("/mentions/1", list)).toBe("/mentions");
    expect(resolveActiveHref("/settings/members", list)).toBe("/settings/project");
  });
  it("does not match a partial segment", () => {
    expect(resolveActiveHref("/mentionsx", list)).toBeUndefined();
  });

  // #331: Overview / Mentions keep the shared filter keys
  it("carries shared filters between Overview and Mentions, keeping the current plate", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "viewer")]));
    pathname = "/mentions";
    search = "preset=30d&sentiment=negative";
    render(<AppSidebar />, { wrapper: Providers });
    await screen.findAllByText("Chỉ xem");
    const hrefs = screen.getAllByRole("link", { hidden: true }).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/overview?preset=30d");
    expect(hrefs).toContain("/mentions?preset=30d");
    expect(hrefs).toContain("/reviews");
    expect(new Set(currentLabels())).toEqual(new Set(["Bài nhắc"]));
  });

  it("does not carry filters from other screens", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "viewer")]));
    pathname = "/listening-queries";
    search = "preset=30d";
    render(<AppSidebar />, { wrapper: Providers });
    await screen.findAllByText("Chỉ xem");
    const hrefs = screen.getAllByRole("link", { hidden: true }).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/overview");
    expect(hrefs).not.toContain("/overview?preset=30d");
  });
});
