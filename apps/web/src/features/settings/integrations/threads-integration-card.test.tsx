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
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

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
    expect(screen.getByText("Chỉ quản trị viên dự án mới thay đổi được các cài đặt này.")).toBeInTheDocument();
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
    expect(toast.error).toHaveBeenCalledWith("Token không hợp lệ hoặc đã hết hạn.");
  });

  it("INTEGRATION_NOT_CONFIGURED maps to the update-first copy", async () => {
    apiFetch.mockImplementation((_p: string, init?: RequestInit) =>
      init?.method === "POST"
        ? Promise.reject(new ApiError(409, "INTEGRATION_NOT_CONFIGURED", "x"))
        : Promise.resolve(threadsStatusFixture({ status: "disconnected" })),
    );
    renderLive(threadsStatusFixture({ status: "disconnected" }));
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra kết nối" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Chưa có token. Cập nhật token trước."));
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
