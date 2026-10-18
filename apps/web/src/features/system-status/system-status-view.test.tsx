import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRole } from "@how-about-me/contracts";
import type * as ClientModule from "@/lib/api/client";
import { liveQueryFixture, statusFixture, uuid } from "./fixtures.test-utils";
import { SystemStatusView } from "./system-status-view";

const PID = "11111111-1111-4111-8111-111111111111";
const apiFetch = vi.fn();
let search = "";
let role: UserRole = "admin";

vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/system-status",
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/features/auth/use-current-project", () => ({
  useCurrentProject: () => ({ project: { id: PID, timezone: "Asia/Ho_Chi_Minh" } }),
}));
vi.mock("@/features/auth/use-role", () => ({
  useRole: () => ({ isLoading: false, hasRole: (rs: readonly UserRole[]) => rs.includes(role) }),
}));

const paths = () => (apiFetch.mock.calls as [string][]).map(([p]) => p);

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SystemStatusView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation((p: string) =>
    p.endsWith("/audit-logs") ? Promise.resolve({ items: [], nextCursor: null }) : new Promise(() => {}),
  );
  search = "";
});

describe("SystemStatusView audit tab gating (TC-SYS-015)", () => {
  it.each(["analyst", "viewer"] as const)("%s: no tab, deep-link falls back to Overview, no API call", async (r) => {
    role = r;
    search = "tab=audit-log";
    setup();
    expect(screen.queryByRole("link", { name: "Nhật ký thao tác" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tổng quan" })).toHaveAttribute("aria-current", "page");
    await waitFor(() => expect(paths().some((p) => p.endsWith("/system-status"))).toBe(true));
    expect(paths().some((p) => p.endsWith("/audit-logs"))).toBe(false);
  });

  it("admin sees the tab and loads the audit log", async () => {
    role = "admin";
    search = "tab=audit-log";
    setup();
    expect(screen.getByRole("link", { name: "Nhật ký thao tác" })).toHaveAttribute("aria-current", "page");
    await waitFor(() => expect(paths().some((p) => p.endsWith("/audit-logs"))).toBe(true));
  });
});

describe("SystemStatusView overview: queries with errors (#342)", () => {
  const failedJob = {
    id: uuid(1),
    status: "failed" as const,
    recordsFetched: 0,
    recordsInserted: 0,
    completedAt: null,
  };
  const err = { code: "X", message: "m", at: "2026-10-13T02:00:00.000Z" };

  it("counts erroring queries from the listening-queries list", async () => {
    role = "viewer";
    apiFetch.mockImplementation((p: string) =>
      p.endsWith("/system-status")
        ? Promise.resolve(statusFixture())
        : p.endsWith("/listening-queries")
          ? Promise.resolve({
              items: [liveQueryFixture({ lastJob: failedJob, lastError: err }), liveQueryFixture()],
              nextCursor: null,
            })
          : new Promise(() => {}),
    );
    setup();
    expect(await screen.findByText("Truy vấn đang lỗi")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1 truy vấn đang lỗi" })).toHaveAttribute("href", "/listening-queries");
  });

  it("a failed list load hides the row but keeps the overview", async () => {
    apiFetch.mockImplementation((p: string) =>
      p.endsWith("/system-status") ? Promise.resolve(statusFixture()) : Promise.reject(new Error("boom")),
    );
    setup();
    expect(await screen.findByRole("region", { name: "Bộ thu thập" })).toBeInTheDocument();
    expect(screen.queryByText("Truy vấn đang lỗi")).not.toBeInTheDocument();
  });
});

describe("SystemStatusView chrome (#343 ops-10)", () => {
  const statusOnly = () =>
    apiFetch.mockImplementation((p: string) =>
      p.endsWith("/system-status") ? Promise.resolve(statusFixture()) : new Promise(() => {}),
    );

  it("'Cập nhật … trước' shows on Tổng quan; tabs are ≥ 44 px", async () => {
    role = "admin";
    statusOnly();
    setup();
    expect(await screen.findByText(/^Cập nhật \d+ giây trước$/)).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Các mục trạng thái" });
    for (const tab of nav.querySelectorAll("a")) expect(tab).toHaveClass("min-h-11");
  });

  it("#348: section tabs are links (no ARIA tablist) that keep filters and drop the open job", async () => {
    role = "admin";
    search = "tab=sync-jobs&status=failed&job=j1&from=2026-10-01";
    // The open job drawer is modal, so the page behind it is aria-hidden (hidden: true).
    setup();
    expect(screen.queryByRole("tab", { hidden: true })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lượt đồng bộ", hidden: true })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Tổng quan", hidden: true })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Lỗi phân tích", hidden: true })).toHaveAttribute(
      "href",
      "/system-status?status=failed&from=2026-10-01&tab=analysis-failures",
    );
    expect(screen.getByRole("link", { name: "Tổng quan", hidden: true })).toHaveAttribute(
      "href",
      "/system-status?status=failed&from=2026-10-01",
    );
  });

  it.each(["sync-jobs", "analysis-failures", "audit-log"])("no 'Cập nhật' on ?tab=%s", async (t) => {
    role = "admin";
    search = `tab=${t}`;
    statusOnly();
    setup();
    await waitFor(() => expect(paths().some((p) => p.endsWith("/system-status"))).toBe(true));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/^Cập nhật \d+ giây trước$/)).not.toBeInTheDocument();
  });
});
