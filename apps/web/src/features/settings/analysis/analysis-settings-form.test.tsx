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
const submit = () => screen.getByRole("button", { name: "Create new policy version" });

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
    fireEvent.change(cell("Hate sensitive"), { target: { value: "0.4" } });
    fireEvent.click(submit());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Created safety-policy-v2"));
    const [path, init] = apiFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`/projects/${P1}/settings/analysis`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ safetyThresholds: { hate: { sensitive: 0.4, severe: 0.8 } } });
  });

  it("FR-015: non-admins get disabled inputs and no submit button", () => {
    renderForm(false);
    expect(cell("Hate sensitive")).toBeDisabled();
    expect(screen.getByRole("spinbutton", { name: /High/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Create new policy version" })).not.toBeInTheDocument();
  });

  it("BR-018: server VALIDATION_ERROR shows under the matching cell", async () => {
    apiFetch.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "invalid", "req-1", {
        issues: [{ path: "safetyThresholds.hate.sensitive", message: "server says no", code: "custom" }],
      }),
    );
    renderForm();
    fireEvent.change(cell("Hate sensitive"), { target: { value: "0.4" } });
    fireEvent.click(submit());
    expect(await screen.findByText("server says no")).toBeInTheDocument();
    expect(cell("Hate sensitive")).toHaveAttribute("aria-invalid", "true");
  });

  it("BR-021: client blocks medium ≥ high without calling the API", () => {
    renderForm();
    fireEvent.change(screen.getByRole("spinbutton", { name: /Medium/ }), { target: { value: "0.9" } });
    fireEvent.click(submit());
    expect(screen.getByText("medium must be lower than high")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("FR-015: FORBIDDEN_ROLE shows the permission copy", async () => {
    apiFetch.mockRejectedValue(new ApiError(403, "FORBIDDEN_ROLE", "forbidden", "req-1"));
    renderForm();
    fireEvent.change(cell("Hate sensitive"), { target: { value: "0.4" } });
    fireEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent("You don't have permission.");
  });
});
