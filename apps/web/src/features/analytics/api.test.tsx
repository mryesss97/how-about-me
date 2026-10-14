import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { usePhraseSentiment } from "./api";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

const PID = "11111111-1111-4111-8111-111111111111";
const params = { compare: "true", from: "a", relevance: "relevant", timezone: "UTC", to: "b" };
const response = { sentimentAnalyzed: 0, phraseAnalyzed: 0, totalPhrases: 0, minMentions: 2, limit: 30, rows: [] };

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** #243 (FR-148): the phrases request only runs in Phrases mode. */
describe("usePhraseSentiment (#243)", () => {
  it("does not request /analytics/phrases while disabled (Topics mode)", () => {
    apiFetch.mockReset();
    renderHook(() => usePhraseSentiment(PID, params, { enabled: false }), { wrapper });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("#251: sends limit=30 without minMentions (server applies the project setting) and drops compare when enabled", async () => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue(response);
    const { result } = renderHook(() => usePhraseSentiment(PID, params, { enabled: true }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetch).toHaveBeenCalledWith(`/projects/${PID}/analytics/phrases`, {
      params: { from: "a", limit: "30", relevance: "relevant", timezone: "UTC", to: "b" },
    });
  });
});
