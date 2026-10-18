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
    expect(screen.queryByRole("tab", { name: "Nhật ký thao tác" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tổng quan" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(paths().some((p) => p.endsWith("/system-status"))).toBe(true));
    expect(paths().some((p) => p.endsWith("/audit-logs"))).toBe(false);
  });

  it("admin sees the tab and loads the audit log", async () => {
    role = "admin";
    search = "tab=audit-log";
    setup();
    expect(screen.getByRole("tab", { name: "Nhật ký thao tác" })).toHaveAttribute("aria-selected", "true");
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
