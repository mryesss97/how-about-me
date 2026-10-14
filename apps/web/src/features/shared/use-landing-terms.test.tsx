import type * as ClientModule from "@/lib/api/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLandingTerms } from "./use-landing-terms";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));

let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);
const BODY = {
  range: { from: "2026-09-14T12:00:00+07:00", to: "2026-10-14T12:00:00+07:00", timezone: "Asia/Ho_Chi_Minh" },
  sentimentAnalyzed: 3,
  rows: [
    { term: "giá vé", positive: 1, neutral: 0, negative: 2, total: 3, dominant: "negative", dominantShare: 2 / 3 },
  ],
};

beforeEach(() => {
  apiFetch.mockReset();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

// FR-149, BR-042 (#261)
describe("useLandingTerms", () => {
  it("GETs landing-terms with params and parses the response", async () => {
    apiFetch.mockResolvedValue(BODY);
    const { result } = renderHook(() => useLandingTerms("p1", { timezone: "UTC" }), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(BODY));
    expect(apiFetch).toHaveBeenCalledWith("/projects/p1/analytics/landing-terms", { params: { timezone: "UTC" } });
  });

  it("disabled without a project id", () => {
    renderHook(() => useLandingTerms(null), { wrapper });
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
