import { deriveCircuitState } from "./circuit-breaker.service";

const now = new Date("2026-10-18T00:00:00Z");
const at = (s: number) => new Date(now.getTime() + s * 1000);

describe("deriveCircuitState (FR-084, TC-COL-020)", () => {
  it("no row → closed", () => {
    expect(deriveCircuitState(null, 5, now)).toMatchObject({ state: "closed", open: false, consecutiveFailures: 0 });
  });

  it("below threshold → closed, reason hidden", () => {
    const s = deriveCircuitState({ consecutiveFailures: 4, circuitOpenUntil: null, circuitReason: "x" }, 5, now);
    expect(s).toMatchObject({ state: "closed", open: false, reason: null });
  });

  it("until in the future → open with reason", () => {
    const s = deriveCircuitState(
      { consecutiveFailures: 5, circuitOpenUntil: at(60), circuitReason: "THREADS_5XX: x" },
      5,
      now,
    );
    expect(s).toMatchObject({ state: "open", open: true, reason: "THREADS_5XX: x", until: at(60) });
  });

  it("at/over threshold and until elapsed → half_open", () => {
    const s = deriveCircuitState({ consecutiveFailures: 6, circuitOpenUntil: at(0), circuitReason: "r" }, 5, now);
    expect(s).toMatchObject({ state: "half_open", open: false, reason: "r" });
  });
});
