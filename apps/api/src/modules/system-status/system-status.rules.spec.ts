import {
  computeAnalysisFailureRate,
  computeAnalysisLagSeconds,
  computeCollectionLagSeconds,
  computeSuccessRate,
  deriveAnalysisStatus,
  deriveCollectorStatus,
} from "./system-status.rules";

const now = new Date("2026-10-18T00:00:00Z");
const ago = (s: number) => new Date(now.getTime() - s * 1000);
const base = {
  circuitOpen: false,
  integrationStatus: "connected",
  successRate24h: 1,
  collectionLagSeconds: 0,
  maxPollIntervalSeconds: 600,
};

describe("system-status rules (doc 09 §4, FR-176, TC-SYS-003/005)", () => {
  it("FR-084: circuit open → paused", () => {
    expect(deriveCollectorStatus({ ...base, circuitOpen: true })).toBe("paused");
  });
  it.each(["expired", "disconnected", "error"])("integration %s → paused even with good rate", (s) => {
    expect(deriveCollectorStatus({ ...base, integrationStatus: s })).toBe("paused");
  });
  it("rate 0.79 → degraded, 0.8 → healthy", () => {
    expect(deriveCollectorStatus({ ...base, successRate24h: 0.79 })).toBe("degraded");
    expect(deriveCollectorStatus({ ...base, successRate24h: 0.8 })).toBe("healthy");
  });
  it("lag = 3×poll → healthy, 3×poll+1 → degraded", () => {
    expect(deriveCollectorStatus({ ...base, collectionLagSeconds: 1800 })).toBe("healthy");
    expect(deriveCollectorStatus({ ...base, collectionLagSeconds: 1801 })).toBe("degraded");
  });
  it("null rate + null lag → healthy", () => {
    expect(deriveCollectorStatus({ ...base, successRate24h: null, collectionLagSeconds: null })).toBe("healthy");
  });
  it("FR-176: lag from the latest sync; no sync → null", () => {
    expect(computeCollectionLagSeconds([ago(500), null, ago(90.5)], now)).toBe(90);
    expect(computeCollectionLagSeconds([], now)).toBeNull();
    expect(computeCollectionLagSeconds([null], now)).toBeNull();
  });
  it("success rate counts partial as success; empty → null", () => {
    expect(computeSuccessRate({ success: 6, partial: 2, failed: 2 })).toBe(0.8);
    expect(computeSuccessRate({ success: 0, partial: 0, failed: 0 })).toBeNull();
  });
});

describe("analysis status rules (T-077, doc 09 §4, TC-SYS-004)", () => {
  const ok = { budgetExceeded: false, authPaused: false, failureRate24h: 0, lagSeconds: 0 };

  it("lag: no open run → 0; floors seconds; never negative", () => {
    expect(computeAnalysisLagSeconds(null, now)).toBe(0);
    expect(computeAnalysisLagSeconds(new Date(now.getTime() - 1999), now)).toBe(1);
    expect(computeAnalysisLagSeconds(new Date(now.getTime() + 5000), now)).toBe(0);
  });

  it("failure rate: empty sample → null; failed/(failed+completed)", () => {
    expect(computeAnalysisFailureRate({ failed: 0, completed: 0 })).toBeNull();
    expect(computeAnalysisFailureRate({ failed: 1, completed: 3 })).toBe(0.25);
  });

  it("budget_paused wins over every degraded signal", () => {
    expect(deriveAnalysisStatus({ budgetExceeded: true, authPaused: true, failureRate24h: 1, lagSeconds: 9999 })).toBe(
      "budget_paused",
    );
  });

  it("degraded on auth pause, rate > 0.1, lag > 1800; boundaries stay healthy", () => {
    expect(deriveAnalysisStatus(ok)).toBe("healthy");
    expect(deriveAnalysisStatus({ ...ok, authPaused: true })).toBe("degraded");
    expect(deriveAnalysisStatus({ ...ok, failureRate24h: 0.11 })).toBe("degraded");
    expect(deriveAnalysisStatus({ ...ok, failureRate24h: 0.1 })).toBe("healthy");
    expect(deriveAnalysisStatus({ ...ok, failureRate24h: null })).toBe("healthy");
    expect(deriveAnalysisStatus({ ...ok, lagSeconds: 1801 })).toBe("degraded");
    expect(deriveAnalysisStatus({ ...ok, lagSeconds: 1800 })).toBe("healthy");
  });
});
