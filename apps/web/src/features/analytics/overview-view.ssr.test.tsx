import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OverviewView } from "./overview-view";

/**
 * #409: the server HTML and the first client render (hydration) must match. `/me` and the analytics queries may
 * already be cached when the Suspense boundary hydrates, so the view reads the project only after hydration:
 * during the server render every data hook gets no project id (→ loading markup), never cached data.
 */
const { seen, record } = vi.hoisted(() => {
  const seen: (string | undefined)[] = [];
  const record = (pid: string | undefined) => {
    seen.push(pid);
    return { data: undefined, isLoading: true, error: null, refetch: () => {} };
  };
  return { seen, record };
});

vi.mock("@/features/auth/use-current-project", () => ({ useCurrentProject: () => ({ project: { id: "p1" } }) }));
vi.mock("@/features/auth/use-role", () => ({ useRole: () => ({ role: "admin" }) }));
vi.mock("@/lib/filters/use-filters", () => ({ useFilters: () => ({ filters: {}, apiParams: {} }) }));
vi.mock("./use-overview-drill-down", () => ({
  useOverviewDrillDown: () => ({ href: () => null, navigate: () => {}, kpiHref: () => "#", pendingHref: "/p" }),
}));
vi.mock("./filter-bar", () => ({ FilterBar: () => <div /> }));
vi.mock("./overview-trend-row", () => ({
  OverviewTrendRow: (p: { projectId?: string }) => (seen.push(p.projectId), null),
}));
vi.mock("./overview-topic-rows", () => ({ OverviewTopicRows: () => null }));
vi.mock("./overview-p1-row", () => ({ OverviewP1Row: () => null }));
vi.mock("./api", () => ({ useOverview: record, useTopicSentiment: record }));

describe("OverviewView server render (#409)", () => {
  it("passes no project id to any data hook before hydration, even when /me is cached", () => {
    seen.length = 0;
    const html = renderToString(<OverviewView />);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((pid) => pid === undefined)).toBe(true);
    expect(html).toContain('aria-busy="true"');
  });
});
