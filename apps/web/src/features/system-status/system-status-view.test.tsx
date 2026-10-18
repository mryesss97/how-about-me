import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRole } from "@how-about-me/contracts";
import type * as ClientModule from "@/lib/api/client";
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
