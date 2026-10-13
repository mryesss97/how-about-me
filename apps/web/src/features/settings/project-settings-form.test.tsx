import type * as ClientModule from "@/lib/api/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    fireEvent.change(screen.getByRole("textbox", { name: /Project name/ }), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/too small|at least|>=1/i)).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("FR-032: PATCHes only the changed setting, toasts and refreshes /me", async () => {
    apiFetch.mockResolvedValue(projectData({ settings: { allowAnalystReanalyze: true, allowViewerExport: true } }));
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    render(<ProjectSettingsForm project={projectData()} canEdit />, { wrapper });
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole("switch", { name: "Allow viewers to export" }));
    fireEvent.click(save);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Project saved"));
    const [path, init] = apiFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`/projects/${P1}`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ settings: { allowViewerExport: true } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["me"] });
  });

  it("BR-033: non-admins get a disabled form without Save", () => {
    render(<ProjectSettingsForm project={projectData()} canEdit={false} />, { wrapper });
    expect(screen.getByRole("textbox", { name: /Project name/ })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Allow viewers to export" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});
