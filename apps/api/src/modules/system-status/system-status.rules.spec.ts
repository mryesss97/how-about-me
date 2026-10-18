import { computeCollectionLagSeconds, computeSuccessRate, deriveCollectorStatus } from "./system-status.rules";

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
