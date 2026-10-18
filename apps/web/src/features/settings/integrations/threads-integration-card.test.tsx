import type * as ClientModule from "@/lib/api/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { INTEGRATION_STATUSES, type ThreadsIntegrationStatus } from "@how-about-me/contracts";
import { P1 } from "@/features/auth/test-utils";
import { ApiError } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";
import { threadsStatusFixture } from "../test-fixtures";
import { useThreadsIntegration } from "./api";
import { STATUS_BADGE, ThreadsIntegrationCard } from "./threads-integration-card";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), loading: vi.fn(() => "t1") }));
vi.mock("sonner", () => ({ toast }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const TZ = "Asia/Ho_Chi_Minh";
const renderCard = (status: ThreadsIntegrationStatus, canEdit: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ThreadsIntegrationCard pid={P1} status={status} canEdit={canEdit} timezone={TZ} />
    </QueryClientProvider>,
  );

/** Card wired to the query cache, so mutations visibly change the badge. */
function Live({ canEdit = true }: { canEdit?: boolean }) {
  const q = useThreadsIntegration(P1);
  return q.data ? <ThreadsIntegrationCard pid={P1} status={q.data} canEdit={canEdit} timezone={TZ} /> : null;
}
const renderLive = (initial: ThreadsIntegrationStatus) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(qk.integration(P1), initial);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return render(<Live />, { wrapper });
};

beforeEach(() => {
  apiFetch.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
  push.mockReset();
  vi.useRealTimers();
});

const NOW = Date.parse("2026-10-19T00:00:00.000Z");
const inDays = (d: number) => new Date(NOW + d * 86_400_000).toISOString();
const isPrimary = (name: string) => screen.getByRole("button", { name }).className.includes("bg-brand-solid");
const listPage = (items: unknown[], nextCursor: string | null = null) => ({ items, nextCursor });

describe("ThreadsIntegrationCard #346", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  it("FR-046 / BR-017: token expiring in 5 days shows 'còn 5 ngày' and the 'Sắp hết hạn' plate", () => {
    renderCard(threadsStatusFixture({ tokenExpiresAt: inDays(5) }), true);
    expect(screen.getByText(/còn 5 ngày/)).toBeInTheDocument();
    expect(screen.getByText("Sắp hết hạn")).toBeInTheDocument();
    expect(screen.getByText("Đã kết nối")).toBeInTheDocument();
  });

  it("FR-046: 30 days left shows the count but no plate", () => {
    renderCard(threadsStatusFixture({ tokenExpiresAt: inDays(30) }), true);
    expect(screen.getByText(/còn 30 ngày/)).toBeInTheDocument();
    expect(screen.queryByText("Sắp hết hạn")).toBeNull();
  });

  it("FR-046: null expiry shows neither count nor plate", () => {
    renderCard(threadsStatusFixture({ tokenExpiresAt: null }), true);
    expect(screen.queryByText(/còn \d+ ngày/)).toBeNull();
    expect(screen.queryByText("Sắp hết hạn")).toBeNull();
  });

  it("labels scopes as 'Quyền truy cập'", () => {
    renderCard(threadsStatusFixture(), false);
    expect(screen.getByText("Quyền truy cập")).toBeInTheDocument();
  });

  it("healthy connection: 'Kiểm tra kết nối' is the only primary", () => {
    renderCard(threadsStatusFixture({ tokenExpiresAt: inDays(30) }), true);
    expect(isPrimary("Kiểm tra kết nối")).toBe(true);
    expect(isPrimary("Cập nhật token")).toBe(false);
    expect(isPrimary("Ngắt kết nối")).toBe(false);
  });

  it.each([
    ["soon", { tokenExpiresAt: inDays(3) }],
    ["expired", { status: "expired" as const }],
    ["permission_error", { status: "permission_error" as const }],
    ["disconnected", { status: "disconnected" as const }],
  ])("%s: 'Cập nhật token' is the only primary", (_n, over) => {
    renderCard(threadsStatusFixture(over), true);
    expect(isPrimary("Cập nhật token")).toBe(true);
    expect(isPrimary("Kiểm tra kết nối")).toBe(false);
  });

  it("flows-9: verify OK with no enabled query → toast links to creating one", async () => {
    apiFetch.mockImplementation((p: string, init?: RequestInit) =>
      init?.method === "POST"
        ? Promise.resolve(threadsStatusFixture())
        : p.endsWith("/listening-queries")
          ? Promise.resolve(listPage([]))
          : Promise.resolve(threadsStatusFixture()),
    );
    renderLive(threadsStatusFixture());
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra kết nối" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const [msg, opts] = toast.success.mock.calls[0] as [string, { action?: { label: string; onClick: () => void } }];
    expect(msg).toBe("Kết nối Threads hoạt động");
    expect(opts.action?.label).toBe("Thêm truy vấn theo dõi →");
    opts.action?.onClick();
    expect(push).toHaveBeenCalledWith("/listening-queries?new=1");
  });

  it("flows-9: verify OK with an enabled query → plain toast", async () => {
    apiFetch.mockImplementation((p: string, init?: RequestInit) =>
      init?.method === "POST"
        ? Promise.resolve(threadsStatusFixture())
        : p.endsWith("/listening-queries")
          ? Promise.resolve(listPage([{ enabled: true, deletedAt: null }]))
          : Promise.resolve(threadsStatusFixture()),
    );
    renderLive(threadsStatusFixture());
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra kết nối" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect((toast.success.mock.calls[0] as [string, { action?: unknown }])[1].action).toBeUndefined();
  });

  it("flows-9 / FR-043: saving a token runs a separate verify (PUT then POST)", async () => {
    apiFetch.mockImplementation((p: string, init?: RequestInit) =>
      p.endsWith("/listening-queries")
        ? Promise.reject(new Error("down"))
        : Promise.resolve(threadsStatusFixture({ status: init?.method === "PUT" ? "disconnected" : "connected" })),
    );
    renderLive(threadsStatusFixture({ status: "disconnected" }));
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật token" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Access token/), {
      target: { value: "fake-token-for-tests-0123456789" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu token" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const methods = (apiFetch.mock.calls as [string, RequestInit | undefined][])
      .map(([, i]) => i?.method)
      .filter(Boolean);
    expect(methods).toEqual(["PUT", "POST"]);
    expect(toast.loading).toHaveBeenCalledWith("Đã lưu token. Đang kiểm tra kết nối…");
    // List fetch failed → success toast without action, replacing the loading toast.
    expect(toast.success).toHaveBeenCalledWith("Kết nối Threads hoạt động", { id: "t1", action: undefined });
    expect(screen.queryByDisplayValue("fake-token-for-tests-0123456789")).toBeNull();
  });
});

describe("ThreadsIntegrationCard", () => {
  it("TC-INT-012 / FR-043: admin sees update, verify and disconnect", () => {
    renderCard(threadsStatusFixture(), true);
    for (const name of ["Cập nhật token", "Kiểm tra kết nối", "Ngắt kết nối"])
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("TC-INT-012 / FR-015: analyst card is read-only", () => {
    renderCard(threadsStatusFixture(), false);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("Chỉ quản trị viên dự án mới thay đổi được các cài đặt này.")).toBeNull();
  });

  it.each(INTEGRATION_STATUSES)("FR-044: status %s renders its label", (s) => {
    renderCard(threadsStatusFixture({ status: s }), false);
    expect(screen.getByText(STATUS_BADGE[s].label)).toBeInTheDocument();
  });

  it("FR-044: shows last error code + message, null fields as —", () => {
    renderCard(
      threadsStatusFixture({
        accountIdentifier: null,
        grantedScopes: [],
        lastError: { code: "THREADS_UNAUTHORIZED", message: "bad token", at: "2026-10-02T00:00:00.000Z" },
      }),
      false,
    );
    expect(screen.getByText("THREADS_UNAUTHORIZED")).toBeInTheDocument();
    expect(screen.getByText(/bad token/)).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("FR-044: failed verify refetches the committed status (badge → Hết hạn)", async () => {
    apiFetch.mockImplementation((_p: string, init?: RequestInit) =>
      init?.method === "POST"
        ? Promise.reject(new ApiError(502, "THREADS_UNAUTHORIZED", "x", "r1"))
        : Promise.resolve(threadsStatusFixture({ status: "expired" })),
    );
    renderLive(threadsStatusFixture());
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra kết nối" }));
    expect(await screen.findByText("Hết hạn")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Lỗi: Token không hợp lệ hoặc đã hết hạn.", { id: undefined });
  });

  it("INTEGRATION_NOT_CONFIGURED maps to the update-first copy", async () => {
    apiFetch.mockImplementation((_p: string, init?: RequestInit) =>
      init?.method === "POST"
        ? Promise.reject(new ApiError(409, "INTEGRATION_NOT_CONFIGURED", "x"))
        : Promise.resolve(threadsStatusFixture({ status: "disconnected" })),
    );
    renderLive(threadsStatusFixture({ status: "disconnected" }));
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra kết nối" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Lỗi: Chưa có token. Cập nhật token trước.", { id: undefined }),
    );
  });

  it("FR-043: disconnect is optimistic and rolls back on error", async () => {
    let reject: (e: unknown) => void = () => {};
    apiFetch.mockImplementation((_p: string, init?: RequestInit) =>
      init?.method === "DELETE" ? new Promise((_r, rej) => (reject = rej)) : Promise.resolve(threadsStatusFixture()),
    );
    renderLive(threadsStatusFixture());
    fireEvent.click(screen.getByRole("button", { name: "Ngắt kết nối" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Ngắt kết nối" }));
    expect(await screen.findByText("Chưa kết nối")).toBeInTheDocument();
    reject(new ApiError(500, "INTERNAL", "boom"));
    expect(await screen.findByText("Đã kết nối")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalled();
  });
});
