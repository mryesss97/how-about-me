import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ClientModule from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";
import { jobDetailFixture } from "./fixtures.test-utils";
import { SyncJobDrawer } from "./sync-job-drawer";

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

/** Minimal ListeningQuery for `useQueryNames` (no cross-feature fixture import). */
const namedQuery = (id: string) => ({
  id,
  displayName: "1zone",
  queryValue: "1zone",
  queryType: "keyword",
  searchMode: "KEYWORD",
  scheduledSearchType: "RECENT",
  enabled: true,
  excludeTerms: [],
  includeTerms: [],
  pollIntervalSeconds: 600,
  overlapSeconds: 1200,
  initialBackfillDays: 1,
  nextRunAt: null,
  lastRunAt: null,
  lastSuccessfulSyncAt: null,
  lastError: null,
  lastJob: null,
  matchedPosts: { total: 0, last24h: 0 },
  createdBy: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  deletedAt: null,
});

function setup(job: ReturnType<typeof jobDetailFixture>, isAdmin: boolean, retry?: () => Promise<unknown>) {
  apiFetch.mockImplementation((path: string, init?: { method?: string }) => {
    if (init?.method === "POST") return retry ? retry() : Promise.resolve({ jobId: job.id, status: "queued" });
    if (path.endsWith("/listening-queries"))
      return Promise.resolve({
        items: [namedQuery(job.queryId ?? "")],
        nextCursor: null,
      });
    return Promise.resolve(job);
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <SyncJobDrawer pid={PID} jobId={job.id} tz="Asia/Ho_Chi_Minh" isAdmin={isAdmin} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { invalidate, onClose };
}

beforeEach(() => {
  apiFetch.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

const failed = () =>
  jobDetailFixture({
    status: "failed",
    recordsDuplicated: 7,
    error: { code: "THREADS_TIMEOUT", message: "upstream timed out" },
  });

describe("SyncJobDrawer", () => {
  it("TC-SYS-013: shows counters and the error", async () => {
    setup(failed(), false);
    expect(await screen.findByText("upstream timed out")).toBeInTheDocument();
    expect(screen.getByText("THREADS_TIMEOUT")).toBeInTheDocument();
    expect(screen.getByText("Trùng").nextSibling).toHaveTextContent("7");
  });

  it("TC-SYS-011 / FR-175: admin retries a failed job, invalidates and toasts", async () => {
    const job = failed();
    const { invalidate, onClose } = setup(job, true);
    fireEvent.click(await screen.findByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã xếp lịch thử lại"));
    expect(apiFetch).toHaveBeenCalledWith(`/projects/${PID}/sync-jobs/${job.id}/retry`, { method: "POST" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["project", PID, "sync-jobs"] });
    expect(onClose).toHaveBeenCalled();
  });

  it("TC-SYS-011 / FR-015: viewer sees no retry button", async () => {
    setup(failed(), false);
    await screen.findByText("upstream timed out");
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
  });

  it("no retry button for a successful job", async () => {
    setup(jobDetailFixture({ status: "success" }), true);
    await screen.findByText("Thành công");
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
  });

  it("409 SYNC_JOB_NOT_RETRYABLE → error toast", async () => {
    setup(failed(), true, () => Promise.reject(new ApiError(409, "SYNC_JOB_NOT_RETRYABLE", "no")));
    fireEvent.click(await screen.findByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Lượt đồng bộ này không thể thử lại."));
  });

  it("#340 flows-6: header names the query; footer links back and to its mentions in the job window", async () => {
    const job = jobDetailFixture();
    setup(job, false);
    expect(await screen.findByText("Truy vấn: 1zone (Từ khoá)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Về truy vấn" })).toHaveAttribute("href", "/listening-queries");
    expect(screen.getByRole("link", { name: "Xem bài nhắc của truy vấn →" })).toHaveAttribute(
      "href",
      `/mentions?queryIds=${job.queryId}&preset=custom&from=2026-10-13T02%3A00%3A00.000Z&to=2026-10-13T03%3A00%3A00.000Z`,
    );
  });

  it("#340: a job without a query hides the links", async () => {
    setup(jobDetailFixture({ queryId: null }), false);
    expect(await screen.findByText("Không gắn truy vấn")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Xem bài nhắc của truy vấn →" })).not.toBeInTheDocument();
  });
});
