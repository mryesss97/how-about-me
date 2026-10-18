import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ClientModule from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";
import { BackfillDialog } from "./backfill-dialog";
import { queryFixture } from "./fixtures.test-utils";

const PID = "11111111-1111-4111-8111-111111111111";
const JOB = "33333333-3333-4333-8333-333333333333";
const apiFetch = vi.fn();
const toastSuccess = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() } }));

function job(status: string, over: Record<string, unknown> = {}) {
  return {
    id: JOB,
    queryId: null,
    status,
    trigger: "backfill",
    searchType: "RECENT",
    searchMode: "KEYWORD",
    windowSince: null,
    windowUntil: null,
    startedAt: null,
    completedAt: null,
    pagesFetched: 3,
    recordsFetched: 40,
    recordsInserted: 31,
    recordsUpdated: 0,
    recordsDuplicated: 9,
    recordsInvalid: 0,
    recordsExcluded: 0,
    providerRequests: 3,
    rateLimitEvents: 0,
    lastCursor: null,
    error: null,
    createdAt: "2026-10-18T00:00:00.000Z",
    providerUsage: null,
    ...over,
  };
}

const posts = () => apiFetch.mock.calls.filter((c) => (c[1] as { method?: string } | undefined)?.method === "POST");
const sentBody = () => JSON.parse((posts()[0] as [string, { body: string }])[1].body) as Record<string, unknown>;
const submit = () => screen.getByRole("button", { name: /Bắt đầu lấy dữ liệu/ });

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const q = queryFixture();
  render(
    <QueryClientProvider client={qc}>
      <BackfillDialog pid={PID} query={q} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
  return q;
}

beforeEach(() => {
  apiFetch.mockReset();
  toastSuccess.mockReset();
});

describe("BackfillDialog (FR-063)", () => {
  it("submits RECENT by default to the backfill endpoint", async () => {
    apiFetch.mockImplementation((_u: string, init?: { method?: string }) =>
      Promise.resolve(init?.method === "POST" ? { jobId: JOB, status: "queued" } : job("queued")),
    );
    const q = setup();
    fireEvent.click(submit());
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0]?.[0]).toBe(`/projects/${PID}/listening-queries/${q.id}/backfill`);
    expect(sentBody()).toMatchObject({ searchType: "RECENT" });
    expect(typeof sentBody().since).toBe("string");
  });

  it("sends TOP when selected", async () => {
    apiFetch.mockImplementation((_u: string, init?: { method?: string }) =>
      Promise.resolve(init?.method === "POST" ? { jobId: JOB, status: "queued" } : job("queued")),
    );
    setup();
    // #344: visible "Thứ tự lấy" is the group's accessible name; no raw RECENT/TOP in labels.
    expect(screen.getByRole("radiogroup", { name: "Thứ tự lấy" })).toBeInTheDocument();
    expect(screen.getByText("Nổi bật lấy các bài có nhiều tương tác trước.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Mới nhất trước" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Nổi bật trước" }));
    fireEvent.click(submit());
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(sentBody()).toMatchObject({ searchType: "TOP" });
  });

  it("TC-REV-011: 202 shows progress, polls running → success, then stops polling", async () => {
    let gets = 0;
    apiFetch.mockImplementation((_u: string, init?: { method?: string }) => {
      if (init?.method === "POST") return Promise.resolve({ jobId: JOB, status: "queued" });
      gets += 1;
      return Promise.resolve(job(gets === 1 ? "running" : "success"));
    });
    setup();
    fireEvent.click(submit());
    await waitFor(() => expect(screen.getByTestId("backfill-status")).toHaveTextContent("Đang chạy"));
    expect(toastSuccess).toHaveBeenCalledWith("Đã xếp lịch lấy dữ liệu cũ");
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("backfill-status")).toHaveTextContent("Thành công"), {
      timeout: 5000,
    });
    expect(screen.getByText("31")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    const after = gets;
    await new Promise((r) => setTimeout(r, 3500));
    expect(gets).toBe(after);
  }, 15000);

  it("BR-010: 409 SYNC_ALREADY_RUNNING follows the active job without a second POST", async () => {
    apiFetch.mockImplementation((_u: string, init?: { method?: string }) =>
      init?.method === "POST"
        ? Promise.reject(new ApiError(409, "SYNC_ALREADY_RUNNING", "busy", "req-1", { jobId: JOB }))
        : Promise.resolve(job("running")),
    );
    setup();
    fireEvent.click(submit());
    await waitFor(() => expect(screen.getByText(/Truy vấn đang đồng bộ/)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId("backfill-status")).toHaveTextContent("Đang chạy"));
    expect(posts()).toHaveLength(1);
  });

  it("400 BACKFILL_WINDOW_INVALID shows the inline message", async () => {
    apiFetch.mockRejectedValue(new ApiError(400, "BACKFILL_WINDOW_INVALID", "bad", "req-2"));
    setup();
    fireEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent("Khoảng thời gian không hợp lệ");
  });

  it("submit is disabled while the request is pending", async () => {
    apiFetch.mockReturnValue(new Promise(() => {}));
    setup();
    fireEvent.click(submit());
    await waitFor(() => expect(submit()).toBeDisabled());
    fireEvent.click(submit());
    expect(posts()).toHaveLength(1);
  });
});
