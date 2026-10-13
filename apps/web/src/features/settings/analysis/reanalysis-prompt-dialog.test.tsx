import type * as ClientModule from "@/lib/api/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { P1 } from "@/features/auth/test-utils";
import { analysisSettingsData } from "../test-fixtures";
import { AnalysisSettingsPanel } from "./analysis-settings";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

/** GET returns v1; PATCH returns v2 with the given outdatedCount. */
async function saveWith(outdatedCount: number) {
  apiFetch.mockImplementation((_p: string, init?: RequestInit) =>
    Promise.resolve(
      init?.method === "PATCH"
        ? analysisSettingsData({ version: 2, policyVersion: "safety-policy-v2", isDefault: false, outdatedCount })
        : analysisSettingsData(),
    ),
  );
  render(<AnalysisSettingsPanel pid={P1} canEdit />, { wrapper });
  fireEvent.change(await screen.findByRole("spinbutton", { name: "Hate sensitive" }), { target: { value: "0.4" } });
  fireEvent.click(screen.getByRole("button", { name: "Create new policy version" }));
  await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
}

beforeEach(() => {
  apiFetch.mockReset();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

// TC-REV-010 (M), FR-196
describe("Re-analysis prompt", () => {
  it("opens after save with outdatedCount 42; Re-analyse is disabled; Later closes", async () => {
    await saveWith(42);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("42 posts were analysed with an older policy");
    expect(screen.getByRole("button", { name: "Re-analyse" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it("does not open when outdatedCount is 0", async () => {
    await saveWith(0);
    await screen.findByText("safety-policy-v2");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
