import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ClientModule from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";
import { AnalysisFailuresTab } from "./analysis-failures-tab";
import { analysisRunFixture } from "./fixtures.test-utils";

const PID = "11111111-1111-4111-8111-111111111111";
const apiFetch = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

type Call = [string, { method?: string; body?: string; params?: Record<string, string | undefined> }];
const calls = () => apiFetch.mock.calls as Call[];
const posts = () => calls().filter(([, init]) => init?.method === "POST");

function setup(isAdmin: boolean) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AnalysisFailuresTab pid={PID} tz="Asia/Ho_Chi_Minh" isAdmin={isAdmin} />
    </QueryClientProvider>,
  );
}

type Handler = (path: string, init?: Call[1]) => Promise<unknown>;
function mockApi(runs = [analysisRunFixture()], onPost?: Handler) {
  apiFetch.mockImplementation((path: string, init?: Call[1]) => {
    if (init?.method === "POST") return onPost ? onPost(path, init) : Promise.resolve({});
    if (path.endsWith("/analysis-runs")) return Promise.resolve({ items: runs, nextCursor: null });
    return new Promise(() => {});
  });
}

beforeEach(() => {
  apiFetch.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("AnalysisFailuresTab (FR-175, TC-SYS-012)", () => {
  it("lists failed runs with error code and post link", async () => {
    const run = analysisRunFixture();
    mockApi([run]);
    setup(false);
    expect(await screen.findByText("LLM_TIMEOUT")).toBeInTheDocument();
    // Vietnamese label in the cell; the raw message stays in the tooltip (title).
    expect(screen.getByText("Bộ phân tích phản hồi quá lâu")).toBeInTheDocument();
    expect(screen.getByTitle("LLM_TIMEOUT: Provider timed out")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", `/mentions/${run.postId}`);
    expect(calls()[0]?.[1].params).toMatchObject({ status: "failed", limit: "50" });
  });

  it("shows the empty state", async () => {
    mockApi([]);
    setup(true);
    expect(await screen.findByText("Không có lượt phân tích lỗi")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thử lại tất cả/ })).not.toBeInTheDocument();
  });

  it("shows the error state", async () => {
    apiFetch.mockRejectedValue(new ApiError(500, "INTERNAL", "boom", "req-9"));
    setup(false);
    expect(await screen.findByText(/boom/)).toBeInTheDocument();
  });

  it("FR-015 UX: analyst sees no retry actions", async () => {
    mockApi();
    setup(false);
    await screen.findByText("LLM_TIMEOUT");
    expect(screen.queryByRole("button", { name: /Thử lại/ })).not.toBeInTheDocument();
  });

  it("BR-024: admin retries one run in place", async () => {
    const run = analysisRunFixture();
    mockApi([run], () => Promise.resolve({ runId: run.id, status: "pending" }));
    setup(true);
    fireEvent.click(await screen.findByRole("button", { name: `Thử lại lượt phân tích ${run.id}` }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã xếp lịch thử lại"));
    expect(posts()[0]?.[0]).toBe(`/projects/${PID}/analysis-runs/${run.id}/retry`);
    // invalidation refetches the list
    await waitFor(() => expect(calls().filter(([p, i]) => p.endsWith("/analysis-runs") && !i?.method).length).toBe(2));
  });

  it("BR-024: 409 ANALYSIS_RUN_NOT_RETRYABLE shows a Vietnamese message", async () => {
    const run = analysisRunFixture();
    mockApi([run], () => Promise.reject(new ApiError(409, "ANALYSIS_RUN_NOT_RETRYABLE", "x")));
    setup(true);
    fireEvent.click(await screen.findByRole("button", { name: `Thử lại lượt phân tích ${run.id}` }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Lượt phân tích này không còn ở trạng thái lỗi."));
  });

  it("TC-SYS-012: retry all asks for confirmation and sends limit 500", async () => {
    mockApi([analysisRunFixture()], () => Promise.resolve({ enqueued: 1234 }));
    setup(true);
    fireEvent.click(await screen.findByRole("button", { name: "Thử lại tất cả lỗi (≤ 500)" }));
    fireEvent.click(await screen.findByRole("button", { name: "Huỷ" }));
    expect(posts()).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Thử lại tất cả lỗi (≤ 500)" }));
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã xếp lịch 1.234 lượt phân tích"));
    expect(posts()[0]?.[0]).toBe(`/projects/${PID}/analysis-runs/retry-failed`);
    expect(JSON.parse(posts()[0]?.[1].body ?? "{}")).toEqual({ limit: 500 });
  });
});
