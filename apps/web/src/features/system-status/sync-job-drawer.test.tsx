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

function setup(job: ReturnType<typeof jobDetailFixture>, isAdmin: boolean, retry?: () => Promise<unknown>) {
  apiFetch.mockImplementation((path: string, init?: { method?: string }) => {
    if (init?.method === "POST") return retry ? retry() : Promise.resolve({ jobId: job.id, status: "queued" });
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
});
