import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as ClientModule from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";
import { retryErrorMessage, SYSTEM_STATUS_REFETCH_MS, useSystemStatus } from "./api";
import { statusFixture } from "./fixtures.test-utils";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));

afterEach(() => vi.useRealTimers());

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe("system-status api", () => {
  it("TC-SYS-001 / FR-170: useSystemStatus refetches every 30 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    apiFetch.mockResolvedValue(statusFixture());
    const { result } = renderHook(() => useSystemStatus("p1"), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch.mock.calls[0]?.[0]).toBe("/projects/p1/system-status");
    await act(async () => void (await vi.advanceTimersByTimeAsync(SYSTEM_STATUS_REFETCH_MS)));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
  });

  it("retryErrorMessage maps SYNC_JOB_NOT_RETRYABLE and FORBIDDEN_ROLE", () => {
    expect(retryErrorMessage(new ApiError(409, "SYNC_JOB_NOT_RETRYABLE", "x"))).toBe(
      "Lượt đồng bộ này không thể thử lại.",
    );
    expect(retryErrorMessage(new ApiError(403, "FORBIDDEN_ROLE", "x"))).toBe(
      "Bạn không có quyền thực hiện thao tác này.",
    );
    // BR-024: analysis retry conflicts (FR-175)
    expect(retryErrorMessage(new ApiError(409, "ANALYSIS_RUN_NOT_RETRYABLE", "x"))).toBe(
      "Lượt phân tích này không còn ở trạng thái lỗi.",
    );
    expect(retryErrorMessage(new ApiError(409, "ANALYSIS_ALREADY_PENDING", "x"))).toBe(
      "Bài này đã có lượt phân tích đang chờ.",
    );
    expect(retryErrorMessage(new ApiError(500, "INTERNAL", "boom", "req-1"))).toBe("boom (Mã yêu cầu: req-1)");
  });
});
