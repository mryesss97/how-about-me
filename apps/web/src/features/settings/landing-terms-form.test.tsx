import type * as ClientModule from "@/lib/api/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { P1 } from "@/features/auth/test-utils";
import { LandingTermsForm, landingTermError } from "./landing-terms-form";
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
const withTerms = (landingTerms: string[]) => projectData({ settings: { ...projectData().settings, landingTerms } });
const add = (v: string) => {
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: v } });
  fireEvent.keyDown(input, { key: "Enter" });
};

beforeEach(() => {
  apiFetch.mockReset();
  toastSuccess.mockReset();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

// FR-032, FR-149, BR-042 (#261), UX §3.7
describe("LandingTermsForm", () => {
  it("BR-042: landingTermError normalises, rejects invalid, duplicates and > 20", () => {
    expect(landingTermError("  Giá  Vé ", [])).toBeNull();
    expect(landingTermError("!!!", [])).toMatch(/1–60 ký tự/);
    expect(landingTermError("GIÁ VÉ", ["giá vé"])).toBe("Đã có trong danh sách.");
    expect(
      landingTermError(
        "x",
        Array.from({ length: 20 }, (_, i) => `t${i}`),
      ),
    ).toBe("Tối đa 20 cụm từ.");
  });

  it("admin: adds normalised term, Save disabled until changed, PATCHes only landingTerms and refetches balloons", async () => {
    apiFetch.mockResolvedValue(withTerms(["app", "giá vé"]));
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    render(<LandingTermsForm project={withTerms(["app"])} canEdit />, { wrapper });
    const save = screen.getByRole("button", { name: "Lưu" });
    expect(save).toBeDisabled();
    add("  Giá   VÉ ");
    expect(screen.getByText("giá vé")).toBeInTheDocument();
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã lưu cài đặt trang landing"));
    const [path, init] = apiFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`/projects/${P1}`);
    expect(JSON.parse(String(init.body))).toEqual({ settings: { landingTerms: ["app", "giá vé"] } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["project", P1, "analytics", "landing-terms"] });
  });

  it("BR-042: duplicate after normalisation and invalid term show an error and are not added", () => {
    render(<LandingTermsForm project={withTerms(["app"])} canEdit />, { wrapper });
    add("APP");
    expect(screen.getByText("Đã có trong danh sách.")).toBeInTheDocument();
    add("!!!");
    expect(screen.getByText(/Nhập 1–60 ký tự/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
  });

  it("VALIDATION_ERROR from the server is shown on the field", async () => {
    apiFetch.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "Invalid", "r1", {
        issues: [{ path: "settings", message: "Too many", code: "too_big" }],
      }),
    );
    render(<LandingTermsForm project={withTerms([])} canEdit />, { wrapper });
    add("app");
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByText("Too many")).toBeInTheDocument();
  });

  it("non-admin: read only, no Save, empty copy", () => {
    render(<LandingTermsForm project={withTerms([])} canEdit={false} />, { wrapper });
    expect(screen.queryByRole("button", { name: "Lưu" })).not.toBeInTheDocument();
    expect(screen.getByText("Chưa có cụm từ nào.")).toBeInTheDocument();
  });

  it("#347: non-admin sees terms as static text without remove buttons", () => {
    render(<LandingTermsForm project={withTerms(["giá vé", "app"])} canEdit={false} />, { wrapper });
    expect(screen.getByRole("list", { name: "Cụm từ trên landing" })).toHaveTextContent("giá vé");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("#347: 'Huỷ thay đổi' drops the draft back to the saved terms", () => {
    render(<LandingTermsForm project={withTerms(["app"])} canEdit />, { wrapper });
    add("giá vé");
    expect(screen.getByText("Có thay đổi chưa lưu")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Huỷ thay đổi" }));
    expect(screen.queryByText("giá vé")).toBeNull();
    expect(screen.getByText("Chưa có thay đổi")).toBeInTheDocument();
  });
});
