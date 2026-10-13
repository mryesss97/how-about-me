import { collectorStatus, growth, lastSyncWindowMs, rate } from "./overview.math";

describe("overview.math (T-091)", () => {
  it("rate: zero denominator → null (FR-132, A12, TC-DASH-008)", () => {
    expect(rate(0, 0)).toEqual({ value: null, numerator: 0, denominator: 0 });
    expect(rate(1, 4).value).toBe(0.25);
  });

  it("growth: previous 0 → new (FR-133, A11, TC-DASH-007)", () => {
    expect(growth(5, 0)).toEqual({ growthPct: null, growthState: "new" });
    expect(growth(0, 0)).toEqual({ growthPct: null, growthState: "new" });
  });

  it("growth: percentage rounded to 1 decimal (2481 vs 2043 → 21.4 up)", () => {
    expect(growth(2481, 2043)).toEqual({ growthPct: 21.4, growthState: "up" });
    expect(growth(50, 100)).toEqual({ growthPct: -50, growthState: "down" });
    // #211: wire unit is percent (105 vs 40 → 162.5, not 1.625)
    expect(growth(105, 40)).toEqual({ growthPct: 162.5, growthState: "up" });
  });

  it("growth: flat below 0.5% and not at the boundary", () => {
    expect(growth(1004, 1000).growthState).toBe("flat");
    expect(growth(996, 1000).growthState).toBe("flat");
    expect(growth(1005, 1000).growthState).toBe("up");
    expect(growth(995, 1000).growthState).toBe("down");
  });

  it("collectorStatus: paused > degraded > healthy", () => {
    const now = new Date("2026-10-13T00:00:00Z");
    const base = { circuitOpenUntil: null, lastSyncStatus: "success", integrationStatus: "connected", now };
    expect(collectorStatus(base)).toBe("healthy");
    expect(collectorStatus({ ...base, circuitOpenUntil: new Date(now.getTime() + 1000) })).toBe("paused");
    expect(collectorStatus({ ...base, circuitOpenUntil: new Date(now.getTime() - 1000) })).toBe("healthy");
    expect(collectorStatus({ ...base, lastSyncStatus: "partial" })).toBe("degraded");
    expect(collectorStatus({ ...base, lastSyncStatus: "failed" })).toBe("degraded");
    expect(collectorStatus({ ...base, integrationStatus: "expired" })).toBe("degraded");
  });

  it("lastSyncWindowMs defaults to 2 × 600 s", () => {
    expect(lastSyncWindowMs(null)).toBe(1_200_000);
    expect(lastSyncWindowMs(300)).toBe(600_000);
  });
});
