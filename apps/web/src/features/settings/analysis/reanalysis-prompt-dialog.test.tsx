import type * as ClientModule from "@/lib/api/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { P1 } from "@/features/auth/test-utils";
import { analysisSettingsData } from "../test-fixtures";
import { ApiError } from "@/lib/api/client";
import { AnalysisSettingsPanel } from "./analysis-settings";
import { retryAfterSeconds } from "./api";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a) } }));

const OLD = "openai:gpt-x:p1:t1:safety-policy-v1";
const NEW = "openai:gpt-x:p1:t1:safety-policy-v2";
type Init = RequestInit & { params?: Record<string, unknown> };
/** mark-stale handler; default returns a dry-run/real response. */
let markStale: (init: Init) => Promise<unknown>;

let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

/** GET returns v1; PATCH returns v2 with the given outdatedCount. */
async function saveWith(outdatedCount: number, canEdit = true) {
  apiFetch.mockImplementation((p: string, init?: Init) => {
    if (p.endsWith("/mark-stale")) return markStale(init ?? {});
    return Promise.resolve(
      init?.method === "PATCH"
        ? analysisSettingsData({
            version: 2,
            policyVersion: "safety-policy-v2",
            effectiveVersion: NEW,
            isDefault: false,
            outdatedCount,
          })
        : analysisSettingsData(),
    );
  });
  render(<AnalysisSettingsPanel pid={P1} canEdit={canEdit} />, { wrapper });
  if (!canEdit) return;
  fireEvent.change(await screen.findByRole("spinbutton", { name: "Hate sensitive" }), { target: { value: "0.4" } });
  fireEvent.click(screen.getByRole("button", { name: "Create new policy version" }));
  await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
}

const markCalls = () => apiFetch.mock.calls.filter((c) => String(c[0]).endsWith("/mark-stale"));

beforeEach(() => {
  apiFetch.mockReset();
  toastSuccess.mockReset();
  markStale = (init) =>
    Promise.resolve(
      init.params?.dryRun ? { marked: 40, enqueued: 0, cap: 500 } : { marked: 40, enqueued: 40, cap: 500 },
    );
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

// TC-REV-010 (M), FR-196
describe("Re-analysis prompt", () => {
  it("opens after save with outdatedCount 42; Later closes without calling mark-stale", async () => {
    await saveWith(42);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("42 posts were analysed with an older policy");
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it("does not open when outdatedCount is 0", async () => {
    await saveWith(0);
    await screen.findByText("safety-policy-v2");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // FR-196, BR-023: preview with the pre-save effectiveVersion, then confirm.
  it("previews with dryRun=true for the old effectiveVersion, then confirms and toasts enqueued", async () => {
    await saveWith(42);
    fireEvent.click(await screen.findByRole("button", { name: "Re-analyse" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "40 results will be marked stale; up to 500 posts will be re-analysed now.",
    );
    expect(markCalls()[0]?.[0]).toBe(`/projects/${P1}/analysis-runs/mark-stale`);
    expect(markCalls()[0]?.[1]).toMatchObject({ method: "POST", params: { version: OLD, dryRun: true } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(markCalls()[1]?.[1]).toMatchObject({ params: { version: OLD, dryRun: false } });
    expect(toastSuccess).toHaveBeenCalledWith("Re-analysis queued for 40 posts");
  });

  it("429 RATE_LIMITED shows the retry wait and disables Confirm", async () => {
    markStale = (init) =>
      init.params?.dryRun
        ? Promise.resolve({ marked: 40, enqueued: 0, cap: 500 })
        : Promise.reject(new ApiError(429, "RATE_LIMITED", "slow down", "r1", { retryAfterSeconds: 120 }));
    await saveWith(42);
    fireEvent.click(await screen.findByRole("button", { name: "Re-analyse" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again in 2 minutes.");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  // BR-023: the current version cannot be staled.
  it("400 VALIDATION_ERROR says already current and leaves only Close", async () => {
    markStale = () => Promise.reject(new ApiError(400, "VALIDATION_ERROR", "current", "r2"));
    await saveWith(42);
    fireEvent.click(await screen.findByRole("button", { name: "Re-analyse" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already current");
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
    expect(markCalls()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("toasts when nothing was enqueued (dedupe) and says posts above the cap stay stale", async () => {
    markStale = (init) =>
      Promise.resolve(
        init.params?.dryRun ? { marked: 900, enqueued: 0, cap: 500 } : { marked: 900, enqueued: 0, cap: 500 },
      );
    await saveWith(42);
    fireEvent.click(await screen.findByRole("button", { name: "Re-analyse" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Posts above this limit stay stale until the next bulk re-analysis.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("No posts needed re-analysis"));
  });

  it("preview with marked 0 offers only Close and never makes the real call", async () => {
    markStale = () => Promise.resolve({ marked: 0, enqueued: 0, cap: 500 });
    await saveWith(42);
    fireEvent.click(await screen.findByRole("button", { name: "Re-analyse" }));
    expect(await screen.findByText("No results of the older policy are left to re-analyse.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(markCalls()).toHaveLength(1);
  });

  it("other errors show a generic message with the requestId and allow retry", async () => {
    markStale = () => Promise.reject(new ApiError(500, "INTERNAL", "boom", "req-9"));
    await saveWith(42);
    fireEvent.click(await screen.findByRole("button", { name: "Re-analyse" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not start re-analysis (request req-9).");
    expect(screen.getByRole("button", { name: "Re-analyse" })).toBeEnabled();
  });

  // FR-015: non-admins never get the prompt.
  it("non-admin (canEdit=false) has no Re-analyse button", async () => {
    await saveWith(42, false);
    await screen.findByRole("spinbutton", { name: "Hate sensitive" });
    expect(screen.queryByRole("button", { name: "Re-analyse" })).not.toBeInTheDocument();
  });
});

describe("retryAfterSeconds", () => {
  it("reads details.retryAfterSeconds only from RATE_LIMITED", () => {
    expect(retryAfterSeconds(new ApiError(429, "RATE_LIMITED", "x", "r", { retryAfterSeconds: 30 }))).toBe(30);
    expect(retryAfterSeconds(new ApiError(429, "RATE_LIMITED", "x", "r", {}))).toBeNull();
    expect(retryAfterSeconds(new Error("x"))).toBeNull();
  });
});
