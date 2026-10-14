import type * as ClientModule from "@/lib/api/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { P1 } from "@/features/auth/test-utils";
import { projectData } from "../test-fixtures";
import { PhraseThresholdForm, parsePhraseThreshold } from "./phrase-threshold-form";

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
const input = () => screen.getByRole("spinbutton", { name: /Minimum mentions per phrase/ });
const setValue = (v: string) => fireEvent.change(input(), { target: { value: v } });

beforeEach(() => {
  apiFetch.mockReset();
  toastSuccess.mockReset();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

// FR-032, FR-148 (#251), UX §3.7
describe("PhraseThresholdForm", () => {
  it("parsePhraseThreshold accepts integers 1–50 only", () => {
    expect(parsePhraseThreshold("1")).toBe(1);
    expect(parsePhraseThreshold("50")).toBe(50);
    for (const bad of ["", " ", "0", "51", "2.5", "abc"]) expect(parsePhraseThreshold(bad)).toBeNull();
  });

  it("admin: shows the current value, Save disabled until changed, PATCHes the setting and refetches phrases", async () => {
    apiFetch.mockResolvedValue(projectData({ settings: { ...projectData().settings, phraseMinMentions: 5 } }));
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    render(<PhraseThresholdForm project={projectData()} canEdit />, { wrapper });
    expect(input()).toHaveValue(2);
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    setValue("5");
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Sentiment map settings saved"));
    const [path, init] = apiFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`/projects/${P1}`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ settings: { phraseMinMentions: 5 } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["project", P1, "analytics", "phrases"] });
  });

  it.each(["0", "51", "2.5", ""])("invalid %p → field error, Save disabled, no API call", (v) => {
    render(<PhraseThresholdForm project={projectData()} canEdit />, { wrapper });
    setValue(v);
    expect(screen.getByText("Enter a whole number from 1 to 50.")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("server VALIDATION_ERROR → field error; other errors → alert", async () => {
    apiFetch.mockRejectedValueOnce(new ApiError(400, "VALIDATION_ERROR", "Invalid", "r1"));
    render(<PhraseThresholdForm project={projectData()} canEdit />, { wrapper });
    setValue("5");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a whole number from 1 to 50.")).toBeInTheDocument();
    apiFetch.mockRejectedValueOnce(new ApiError(500, "UNKNOWN", "Boom", "r2"));
    setValue("6");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("FR-015: non-admins see a disabled input without Save", () => {
    render(<PhraseThresholdForm project={projectData()} canEdit={false} />, { wrapper });
    expect(input()).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByText("Only project admins can change these settings.")).toBeInTheDocument();
  });
});
