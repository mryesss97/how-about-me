import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OverviewFreshness } from "./overview-freshness";

const state = vi.hoisted(() => ({ lastSyncAt: null as string | null, loaded: true }));
vi.mock("@/features/auth/use-current-project", () => ({ useCurrentProject: () => ({ project: { id: "p1" } }) }));
vi.mock("@/lib/filters/use-filters", () => ({
  useFilters: () => ({ apiParams: { timezone: "Asia/Ho_Chi_Minh" } }),
}));
vi.mock("./api", async () => {
  const { overviewFixture: fx } = await import("@/features/shared/overview-fixture.test-utils");
  return {
    useOverview: () => {
      const base = fx();
      return {
        data: state.loaded
          ? { ...base, dataQuality: { ...base.dataQuality, lastSyncAt: state.lastSyncAt } }
          : undefined,
        dataUpdatedAt: 1,
      };
    },
  };
});

/** #336 — fascia freshness line (UX §3.2). */
describe("OverviewFreshness (#336)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T05:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("prints 'Đồng bộ lần cuối 5 phút trước' and ticks every minute", async () => {
    state.loaded = true;
    state.lastSyncAt = "2026-10-14T04:55:00Z";
    render(<OverviewFreshness />);
    expect(screen.getByText("Đồng bộ lần cuối 5 phút trước")).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("Đồng bộ lần cuối 6 phút trước")).toBeInTheDocument();
  });

  it("older than 24h → dd/MM HH:mm in Asia/Ho_Chi_Minh", () => {
    state.loaded = true;
    state.lastSyncAt = "2026-10-12T02:30:00Z";
    render(<OverviewFreshness />);
    expect(screen.getByText("Đồng bộ lần cuối 12/10 09:30")).toBeInTheDocument();
  });

  it("never synced → 'Chưa đồng bộ'; no data yet → nothing printed", () => {
    state.loaded = true;
    state.lastSyncAt = null;
    const { unmount } = render(<OverviewFreshness />);
    expect(screen.getByText("Chưa đồng bộ")).toBeInTheDocument();
    unmount();
    state.loaded = false;
    const { container } = render(<OverviewFreshness />);
    expect(container.textContent).toBe("");
  });
});
