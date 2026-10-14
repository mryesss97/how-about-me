import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ClientModule from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";
import { canExport, ExportButton } from "./export-button";

const apiDownload = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiDownload: (...a: unknown[]) => apiDownload(...a),
}));
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

const PID = "11111111-1111-4111-8111-111111111111";
const params = { from: "2026-10-01T00:00:00Z", to: "2026-10-08T00:00:00Z", relevance: "relevant" };

function setup() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ExportButton pid={PID} params={params} />
    </QueryClientProvider>,
  );
  return screen.getByRole("button", { name: /export csv/i });
}

beforeEach(() => {
  apiDownload.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  // jsdom does not implement navigation for <a download>.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});

describe("canExport (FR-032, BR-033 — UX only)", () => {
  it.each([
    ["admin", false, true],
    ["analyst", false, true],
    ["viewer", false, false],
    ["viewer", true, true],
    [null, true, false],
  ] as const)("%s with allowViewerExport=%s → %s", (role, allow, expected) => {
    expect(canExport(role, { allowViewerExport: allow })).toBe(expected);
  });
  it("viewer without settings → false", () => expect(canExport("viewer", null)).toBe(false));
});

describe("ExportButton (T-147, FR-180/181)", () => {
  it("downloads with the list params and toasts success", async () => {
    apiDownload.mockResolvedValue({ blob: new Blob(["x"]), filename: "mentions-20261014-0030.csv" });
    fireEvent.click(setup());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Export ready"));
    expect(apiDownload).toHaveBeenCalledWith(`/projects/${PID}/mentions/export.csv`, { params });
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("disables the button while exporting", async () => {
    apiDownload.mockReturnValue(new Promise(() => undefined));
    const btn = setup();
    fireEvent.click(btn);
    await waitFor(() => expect(btn).toBeDisabled());
  });

  it("413 EXPORT_TOO_LARGE → toast with the formatted cap", async () => {
    apiDownload.mockRejectedValue(new ApiError(413, "EXPORT_TOO_LARGE", "m", "r", { cap: 10000 }));
    fireEvent.click(setup());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(JSON.stringify(toastError.mock.calls[0])).toContain("10.000");
  });

  it("429 RATE_LIMITED → toast with seconds", async () => {
    apiDownload.mockRejectedValue(new ApiError(429, "RATE_LIMITED", "m", "r", { retryAfterSeconds: 42 }));
    fireEvent.click(setup());
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Export limit reached. Try again in 42 seconds."));
  });
});
