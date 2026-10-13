import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ClientModule from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";
import { BulkReanalyzeButton, canBulkReanalyze } from "./bulk-reanalyze-dialog";

const PID = "11111111-1111-4111-8111-111111111111";
const apiFetch = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a) } }));

const PARAMS = { relevance: "relevant", sentiment: "negative,neutral", sort: "newest", tz: "Asia/Ho_Chi_Minh" };
type Init = { method?: string; body?: string };
const bodies = () =>
  (apiFetch.mock.calls as [string, Init][]).map(([p, init]) => {
    expect(p).toBe(`/projects/${PID}/mentions/reanalyze`);
    expect(init.method).toBe("POST");
    return JSON.parse(init.body ?? "{}") as Record<string, unknown>;
  });

function open() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <BulkReanalyzeButton pid={PID} params={PARAMS} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /re-analyze/i }));
}

beforeEach(() => {
  apiFetch.mockReset();
  toastSuccess.mockReset();
});

describe("BulkReanalyzeDialog (T-146, FR-196)", () => {
  it("is admin only (UX; server enforces FR-015)", () => {
    expect(canBulkReanalyze("admin")).toBe(true);
    expect(canBulkReanalyze("analyst")).toBe(false);
    expect(canBulkReanalyze("viewer")).toBe(false);
    expect(canBulkReanalyze(null)).toBe(false);
  });

  it("TC-REV-008: opening runs a dry run with the list filters and shows matched + cap", async () => {
    apiFetch.mockResolvedValueOnce({ matched: 42, enqueued: 0, cap: 500 });
    open();
    await screen.findByText(/42 mentions match the current filters/);
    expect(screen.getByText(/Up to 500 posts/)).toBeTruthy();
    expect(screen.queryByText(/Narrow the filters/)).toBeNull();
    const [body] = bodies();
    // BR-016: relevance filter passes through unchanged; CSV params become arrays.
    expect(body).toMatchObject({ dryRun: true, relevance: ["relevant"], sentiment: ["negative", "neutral"] });
  });

  it("Confirm runs dryRun=false with the same filters, toasts enqueued and closes", async () => {
    apiFetch.mockResolvedValueOnce({ matched: 42, enqueued: 0, cap: 500 });
    apiFetch.mockResolvedValueOnce({ matched: 42, enqueued: 40, cap: 500 });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Re-analysis queued for 40 posts"));
    const [dry, real] = bodies();
    expect(real).toEqual({ ...dry, dryRun: false });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("BR-024: enqueued=0 toasts that nothing needed re-analysis", async () => {
    apiFetch.mockResolvedValueOnce({ matched: 3, enqueued: 0, cap: 500 });
    apiFetch.mockResolvedValueOnce({ matched: 3, enqueued: 0, cap: 500 });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("No posts needed re-analysis"));
  });

  it("matched=0 offers only Close and never runs for real", async () => {
    apiFetch.mockResolvedValueOnce({ matched: 0, enqueued: 0, cap: 500 });
    open();
    await screen.findByText("No mentions match the current filters.");
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("matched > cap explains the limit", async () => {
    apiFetch.mockResolvedValueOnce({ matched: 1200, enqueued: 0, cap: 500 });
    open();
    await screen.findByText(/Narrow the filters to re-analyze the rest/);
  });

  it("TC-REV-009: 429 shows the wait time and disables Confirm", async () => {
    apiFetch.mockResolvedValueOnce({ matched: 10, enqueued: 0, cap: 500 });
    apiFetch.mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "slow down", "req-1", { retryAfterSeconds: 240 }));
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Try again in 4 minutes");
    expect(screen.getByRole("button", { name: "Confirm" }).hasAttribute("disabled")).toBe(true);
  });

  it("a failed dry run shows the request ID and Retry", async () => {
    apiFetch.mockRejectedValueOnce(new ApiError(500, "UNKNOWN", "boom", "req-9"));
    apiFetch.mockResolvedValueOnce({ matched: 5, enqueued: 0, cap: 500 });
    open();
    expect((await screen.findByRole("alert")).textContent).toContain("req-9");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText(/5 mentions match/);
  });

  it("403 shows a permission message", async () => {
    apiFetch.mockRejectedValueOnce(new ApiError(403, "FORBIDDEN_ROLE", "no", "req-2"));
    open();
    expect((await screen.findByRole("alert")).textContent).toContain("permission");
  });
});
