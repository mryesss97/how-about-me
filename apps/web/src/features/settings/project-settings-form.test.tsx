import type * as ClientModule from "@/lib/api/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { P1 } from "@/features/auth/test-utils";
import { ProjectSettingsForm } from "./project-settings-form";
import { projectData } from "./test-fixtures";

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

beforeEach(() => {
  apiFetch.mockReset();
  toastSuccess.mockReset();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

// FR-032, UX §3.7
describe("ProjectSettingsForm", () => {
  it("shows an inline error for an empty name and does not call the API", async () => {
    render(<ProjectSettingsForm project={projectData()} canEdit />, { wrapper });
    fireEvent.change(screen.getByRole("textbox", { name: /Tên dự án/ }), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByText(/too small|at least|>=1/i)).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("FR-032: PATCHes only the changed setting, toasts and refreshes /me", async () => {
    apiFetch.mockResolvedValue(projectData({ settings: { ...projectData().settings, allowViewerExport: true } }));
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    render(<ProjectSettingsForm project={projectData()} canEdit />, { wrapper });
    const save = screen.getByRole("button", { name: "Lưu" });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole("switch", { name: /^Cho phép Người xem xuất dữ liệu/ }));
    fireEvent.click(save);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã lưu dự án"));
    const [path, init] = apiFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`/projects/${P1}`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ settings: { allowViewerExport: true } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["me"] });
    // #251: a toggle-only PATCH never sends phraseMinMentions nor refetches analytics.
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ["project", P1, "analytics", "phrases"] });
  });

  it("BR-033: non-admins get a disabled form without Save", () => {
    render(<ProjectSettingsForm project={projectData()} canEdit={false} />, { wrapper });
    expect(screen.getByRole("textbox", { name: /Tên dự án/ })).toBeDisabled();
    expect(screen.getByRole("switch", { name: /^Cho phép Người xem xuất dữ liệu/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Lưu" })).not.toBeInTheDocument();
  });

  it("TC-PROJ-006 / FR-032: turning re-analyze off PATCHes only that setting and refreshes /me", async () => {
    apiFetch.mockResolvedValue(projectData({ settings: { ...projectData().settings, allowAnalystReanalyze: false } }));
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    render(<ProjectSettingsForm project={projectData()} canEdit />, { wrapper });
    fireEvent.click(screen.getByRole("switch", { name: /^Cho phép Phân tích viên chạy lại phân tích/ }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã lưu dự án"));
    const [, init] = apiFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ settings: { allowAnalystReanalyze: false } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["me"] });
  });

  it("FR-032: toggling both sends both settings and no name/timezone", async () => {
    apiFetch.mockResolvedValue(projectData({ settings: { ...projectData().settings, allowViewerExport: true } }));
    render(<ProjectSettingsForm project={projectData()} canEdit />, { wrapper });
    fireEvent.click(screen.getByRole("switch", { name: /^Cho phép Phân tích viên chạy lại phân tích/ }));
    fireEvent.click(screen.getByRole("switch", { name: /^Cho phép Người xem xuất dữ liệu/ }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [, init] = apiFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      settings: { allowAnalystReanalyze: false, allowViewerExport: true },
    });
  });

  it("FR-032: toggling on then off again leaves the form clean", () => {
    render(<ProjectSettingsForm project={projectData()} canEdit />, { wrapper });
    const sw = screen.getByRole("switch", { name: /^Cho phép Phân tích viên chạy lại phân tích/ });
    fireEvent.click(sw);
    expect(screen.getByRole("button", { name: "Lưu" })).toBeEnabled();
    fireEvent.click(sw);
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
  });

  it("T-107: shows an explanation under each permission toggle", () => {
    render(<ProjectSettingsForm project={projectData()} canEdit />, { wrapper });
    expect(
      screen.getByText("Phân tích viên có thể đưa bài nhắc vào hàng đợi phân tích lại. Quản trị viên luôn làm được."),
    ).toBeInTheDocument();
    expect(screen.getByText("Người xem có thể tải tệp CSV của bài nhắc và số liệu phân tích.")).toBeInTheDocument();
  });

  it("BR-033: the re-analyze toggle is disabled for non-admins", () => {
    render(<ProjectSettingsForm project={projectData()} canEdit={false} />, { wrapper });
    expect(screen.getByRole("switch", { name: /^Cho phép Phân tích viên chạy lại phân tích/ })).toBeDisabled();
  });

  it("FR-015: a FORBIDDEN_ROLE response shows a permission error", async () => {
    apiFetch.mockRejectedValue(new ApiError(403, "FORBIDDEN_ROLE", "forbidden", "req-1"));
    render(<ProjectSettingsForm project={projectData()} canEdit />, { wrapper });
    fireEvent.click(screen.getByRole("switch", { name: /^Cho phép Người xem xuất dữ liệu/ }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Bạn không có quyền thực hiện thao tác này.");
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
