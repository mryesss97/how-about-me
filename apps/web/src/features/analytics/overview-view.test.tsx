import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OverviewView } from "./overview-view";

vi.mock("@/features/auth/use-current-project", () => ({ useCurrentProject: () => ({ project: { id: "p1" } }) }));
vi.mock("@/features/auth/use-role", () => ({ useRole: () => ({ role: "viewer" }) }));
vi.mock("@/lib/filters/use-filters", () => ({ useFilters: () => ({ filters: {}, apiParams: {} }) }));
vi.mock("./use-overview-drill-down", () => ({
  useOverviewDrillDown: () => ({ href: () => null, navigate: () => {}, kpiHref: () => "#", pendingHref: "/p" }),
}));
vi.mock("./use-query-options", () => ({ useQueryFilterOptions: () => ({ names: {} }) }));
vi.mock("./filter-bar", () => ({ FilterBar: () => <div data-testid="filter-bar" /> }));
vi.mock("./overview-kpi-section", () => ({ OverviewKpiSection: () => <div data-testid="kpi" /> }));
vi.mock("./charts", () => {
  const stub = (name: string) => () => <section data-testid="chart">{name}</section>;
  return Object.fromEntries(
    [
      "MentionsOverTimeChart",
      "SentimentDistributionChart",
      "SentimentOverTimeChart",
      "SafetyDistributionChart",
      "NegativeTopicsChart",
      "TopTopicsChart",
      "SentimentBubbleMap",
      "IntentDistributionChart",
      "QueryShareChart",
      "LanguageDistributionChart",
    ].map((n) => [n, stub(n)]),
  );
});
vi.mock("./api", async () => {
  const { overviewFixture } = await import("@/features/shared/overview-fixture.test-utils");
  const base = overviewFixture();
  const q = { data: undefined, isLoading: false, error: null, refetch: () => {} };
  return {
    useOverview: () => ({ ...q, data: { ...base, dataQuality: { ...base.dataQuality, lastSyncStatus: "failed" } } }),
    useTopicSentiment: () => q,
    useMentionsTimeseries: () => q,
    useSentiment: () => q,
    useSafetyDistribution: () => q,
    useTopicsDistribution: () => q,
    usePhraseSentiment: () => q,
    useIntentsDistribution: () => q,
    useLanguagesDistribution: () => q,
    useQueryShare: () => q,
  };
});

/** #336 — UX §3.2 order: banners → filters → KPI → charts; FR-134, FR-081. */
describe("OverviewView order (#336)", () => {
  it("FR-081: the sync-failed banner sits above the filter bar", () => {
    render(<OverviewView />);
    const banner = screen.getByText(/Lần đồng bộ Threads gần nhất bị lỗi/);
    const filterBar = screen.getByTestId("filter-bar");
    expect(banner.compareDocumentPosition(filterBar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("charts follow the question order; no separate topic × sentiment heatmap", () => {
    render(<OverviewView />);
    expect(screen.getAllByTestId("chart").map((c) => c.textContent)).toEqual([
      "MentionsOverTimeChart",
      "SentimentDistributionChart",
      "SentimentOverTimeChart",
      "SafetyDistributionChart",
      "NegativeTopicsChart",
      "TopTopicsChart",
      "SentimentBubbleMap",
      "IntentDistributionChart",
      "QueryShareChart",
      "LanguageDistributionChart",
    ]);
  });
});
