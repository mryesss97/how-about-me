import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
const table = async () => within(await screen.findByRole("table"));
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
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
function mockApi(runs = [analysisRunFixture()], onPost?: Handler, totalCount?: number) {
  apiFetch.mockImplementation((path: string, init?: Call[1]) => {
    if (init?.method === "POST") return onPost ? onPost(path, init) : Promise.resolve({});
    if (path.endsWith("/analysis-runs"))
      return Promise.resolve({ items: runs, nextCursor: null, ...(totalCount != null ? { totalCount } : {}) });
    return new Promise(() => {});
  });
}

beforeEach(() => {
  apiFetch.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("AnalysisFailuresTab (FR-175, TC-SYS-012)", () => {
  it("#343 ops-11: lists failed runs with error label, post excerpt + @username and no UUID on screen", async () => {
    const run = analysisRunFixture();
    mockApi([run]);
    setup(false);
    const t = await table();
    // Vietnamese label in the cell; code + raw message stay in the tooltip (title).
    expect(t.getByText("Bộ phân tích phản hồi quá lâu")).toBeInTheDocument();
    expect(t.getByTitle("LLM_TIMEOUT: Provider timed out")).toBeInTheDocument();
    expect(t.queryByText("LLM_TIMEOUT")).not.toBeInTheDocument();
    expect(t.getByText("@an.nguyen")).toBeInTheDocument();
    expect(t.getByRole("link", { name: /Giao hàng chậm quá/ })).toHaveAttribute(
      "href",
      `/mentions/${run.postId}?back=${encodeURIComponent("/system-status?tab=analysis-failures")}`, // #331 back link
    );
    expect(screen.getByRole("table").textContent ?? "").not.toMatch(UUID_RE);
    expect(calls()[0]?.[1].params).toMatchObject({ status: "failed", limit: "50", count: "true" });
  });

  it("#343: a media-only post shows 'Bài không có chữ'", async () => {
    mockApi([analysisRunFixture({ post: { excerpt: null, username: "b" } })]);
    setup(false);
    expect((await table()).getByText("Bài không có chữ")).toBeInTheDocument();
  });

  it("#343: toolbar shows the total from totalCount", async () => {
    mockApi([analysisRunFixture()], undefined, 12);
    setup(true);
    expect(await screen.findByText("12 lượt lỗi")).toBeInTheDocument();
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
    await table();
    expect(screen.queryByRole("button", { name: /Thử lại/ })).not.toBeInTheDocument();
  });

  it("BR-024: admin retries one run in place", async () => {
    const run = analysisRunFixture();
    mockApi([run], () => Promise.resolve({ runId: run.id, status: "pending" }));
    setup(true);
    fireEvent.click((await table()).getByRole("button", { name: /Thử lại phân tích bài/ }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã xếp lịch thử lại"));
    expect(posts()[0]?.[0]).toBe(`/projects/${PID}/analysis-runs/${run.id}/retry`);
    // invalidation refetches the list
    await waitFor(() => expect(calls().filter(([p, i]) => p.endsWith("/analysis-runs") && !i?.method).length).toBe(2));
  });

  it("BR-024: 409 ANALYSIS_RUN_NOT_RETRYABLE shows a Vietnamese message", async () => {
    const run = analysisRunFixture();
    mockApi([run], () => Promise.reject(new ApiError(409, "ANALYSIS_RUN_NOT_RETRYABLE", "x")));
    setup(true);
    fireEvent.click((await table()).getByRole("button", { name: /Thử lại phân tích bài/ }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Lượt phân tích này không còn ở trạng thái lỗi."));
  });

  it("TC-SYS-012 / BR-024: retry all confirms with the count and sends limit 500", async () => {
    mockApi([analysisRunFixture()], () => Promise.resolve({ enqueued: 1234 }), 1500);
    setup(true);
    fireEvent.click(await screen.findByRole("button", { name: "Thử lại tất cả (≤ 500)" }));
    fireEvent.click(await screen.findByRole("button", { name: "Huỷ" }));
    expect(posts()).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Thử lại tất cả (≤ 500)" }));
    expect(
      await screen.findByText(/Có 1\.500 lượt lỗi\. Hệ thống sẽ xếp lịch phân tích lại tối đa 500 lượt/),
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã xếp lịch 1.234 lượt phân tích"));
    expect(posts()[0]?.[0]).toBe(`/projects/${PID}/analysis-runs/retry-failed`);
    expect(JSON.parse(posts()[0]?.[1].body ?? "{}")).toEqual({ limit: 500 });
  });

  it("#330 BR-017: retry all is a labelled plaque in the toolbar panel (admin only)", async () => {
    mockApi();
    setup(true);
    const btn = await screen.findByRole("button", { name: "Thử lại tất cả (≤ 500)" });
    expect(btn).toHaveClass("plaque-button");
    expect(btn.closest('[data-testid="failures-toolbar"]')).not.toBeNull();
    expect(screen.getByText("Đã tải 1 lượt lỗi")).toBeInTheDocument();
  });

  it("#343 FR-015 UX: viewer sees the toolbar (count + Làm mới) but no retry plaque", async () => {
    mockApi();
    setup(false);
    const bar = within(await screen.findByTestId("failures-toolbar"));
    expect(bar.getByRole("button", { name: "Làm mới" })).toBeInTheDocument();
    expect(bar.queryByRole("button", { name: /Thử lại tất cả/ })).not.toBeInTheDocument();
  });

  it("#343: 'Làm mới' refetches the list", async () => {
    mockApi();
    setup(false);
    fireEvent.click(within(await screen.findByTestId("failures-toolbar")).getByRole("button", { name: "Làm mới" }));
    await waitFor(() => expect(calls().filter(([p]) => p.endsWith("/analysis-runs")).length).toBe(2));
  });

  it("#343 FR-015 UX: mobile card has a full-width 'Thử lại' for admin only", async () => {
    const run = analysisRunFixture();
    mockApi([run]);
    const { unmount } = setup(true);
    const card = within(await screen.findByTestId(`failure-card-${run.id}`));
    expect(card.getByRole("button", { name: /Thử lại phân tích bài/ })).toHaveClass("w-full");
    unmount();
    setup(false);
    const viewerCard = within(await screen.findByTestId(`failure-card-${run.id}`));
    expect(viewerCard.queryByRole("button")).not.toBeInTheDocument();
    expect(viewerCard.getByText("@an.nguyen")).toBeInTheDocument();
  });

  it("#330: row retry is a plaque and is aria-busy while running", async () => {
    const run = analysisRunFixture();
    mockApi([run], () => new Promise(() => {}));
    setup(true);
    const btn = (await table()).getByRole("button", { name: /^Thử lại phân tích bài "Giao hàng chậm quá/ });
    expect(btn).toHaveClass("plaque-button");
    fireEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute("aria-busy", "true"));
    expect(btn).toBeDisabled();
  });
});
