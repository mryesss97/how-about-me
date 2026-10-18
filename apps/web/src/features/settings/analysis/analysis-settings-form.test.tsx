import type * as ClientModule from "@/lib/api/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { P1 } from "@/features/auth/test-utils";
import { ApiError } from "@/lib/api/client";
import { analysisSettingsData } from "../test-fixtures";
import { AnalysisSettingsForm } from "./analysis-settings-form";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a) } }));

let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);
const renderForm = (canEdit = true) =>
  render(<AnalysisSettingsForm pid={P1} settings={analysisSettingsData()} canEdit={canEdit} />, { wrapper });
const cell = (name: string) => screen.getByRole("spinbutton", { name });
const submit = () => screen.getByRole("button", { name: "Tạo phiên bản chính sách mới" });

beforeEach(() => {
  apiFetch.mockReset();
  toastSuccess.mockReset();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

// FR-190, UX §3.7
describe("AnalysisSettingsForm", () => {
  it("is disabled until something changes", () => {
    renderForm();
    expect(submit()).toBeDisabled();
  });

  it("FR-190: admin edits one cell → PATCH carries only that category", async () => {
    apiFetch.mockResolvedValue(analysisSettingsData({ version: 2, policyVersion: "safety-policy-v2" }));
    renderForm();
    fireEvent.change(cell("Thù ghét – Nhạy cảm"), { target: { value: "0.4" } });
    fireEvent.click(submit());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã tạo safety-policy-v2"));
    const [path, init] = apiFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`/projects/${P1}/settings/analysis`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ safetyThresholds: { hate: { sensitive: 0.4, severe: 0.8 } } });
  });

  it("FR-015 / #347: non-admins read values as text — no inputs, no submit button", () => {
    renderForm(false);
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.getByText("Cao (≥)")).toBeInTheDocument();
    expect(screen.getByText("“—” = không áp dụng mức này.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo phiên bản chính sách mới" })).not.toBeInTheDocument();
  });

  it("#347: '—' placeholder, 0,01–1 hint, and the save bar sits before the version details", () => {
    renderForm();
    expect(cell("Thù ghét – Nhạy cảm")).toHaveAttribute("placeholder", "—");
    expect(screen.getByText("Giá trị 0,01–1. Để trống = không áp dụng mức này.")).toBeInTheDocument();
    const details = screen.getByText("Chi tiết phiên bản (kỹ thuật)");
    expect(submit().compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("#347 / BR-021: invalid bands keep the strip with submit disabled; reset clears it", () => {
    renderForm();
    fireEvent.change(screen.getByRole("spinbutton", { name: /Trung bình/ }), { target: { value: "0.9" } });
    expect(screen.getByText("Có thay đổi chưa lưu")).toBeInTheDocument();
    expect(submit()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Huỷ thay đổi" }));
    expect(screen.queryByText("medium must be lower than high")).toBeNull();
    expect(submit()).toBeDisabled();
  });

  it("BR-018: server VALIDATION_ERROR shows under the matching cell", async () => {
    apiFetch.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "invalid", "req-1", {
        issues: [{ path: "safetyThresholds.hate.sensitive", message: "server says no", code: "custom" }],
      }),
    );
    renderForm();
    fireEvent.change(cell("Thù ghét – Nhạy cảm"), { target: { value: "0.4" } });
    fireEvent.click(submit());
    expect(await screen.findByText("server says no")).toBeInTheDocument();
    expect(cell("Thù ghét – Nhạy cảm")).toHaveAttribute("aria-invalid", "true");
  });

  it("BR-021: client blocks medium ≥ high without calling the API", () => {
    renderForm();
    fireEvent.change(screen.getByRole("spinbutton", { name: /Trung bình/ }), { target: { value: "0.9" } });
    fireEvent.click(submit());
    expect(screen.getByText("medium must be lower than high")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("FR-015: FORBIDDEN_ROLE shows the permission copy", async () => {
    apiFetch.mockRejectedValue(new ApiError(403, "FORBIDDEN_ROLE", "forbidden", "req-1"));
    renderForm();
    fireEvent.change(cell("Thù ghét – Nhạy cảm"), { target: { value: "0.4" } });
    fireEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent("Bạn không có quyền thực hiện thao tác này.");
  });
});
