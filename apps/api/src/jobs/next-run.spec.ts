import { computeNextRunAt, MAX_FAILURE_BACKOFF_SECONDS } from "./next-run";

const completedAt = new Date("2026-10-13T00:10:00Z");
const now = new Date("2026-10-13T00:10:05Z");
const base = { completedAt, now, pollIntervalSeconds: 600 };
const plus = (d: Date, s: number) => new Date(d.getTime() + s * 1000);

describe("computeNextRunAt (FR-071, FR-083)", () => {
  it("TC-COL-002 / BR-012: success → completedAt + interval, failures reset", () => {
    expect(computeNextRunAt({ ...base, status: "success", consecutiveFailures: 3 })).toEqual({
      nextRunAt: plus(completedAt, 600),
      consecutiveFailures: 0,
    });
  });

  it("partial is scheduled like success", () => {
    expect(computeNextRunAt({ ...base, status: "partial", consecutiveFailures: 2 })).toEqual({
      nextRunAt: plus(completedAt, 600),
      consecutiveFailures: 0,
    });
  });

  it.each([
    [0, 600],
    [1, 1200],
    [2, 2400],
  ])("TC-COL-003: failed with n=%i → now + %i s, n+1", (n, delay) => {
    expect(computeNextRunAt({ ...base, status: "failed", consecutiveFailures: n })).toEqual({
      nextRunAt: plus(now, delay),
      consecutiveFailures: n + 1,
    });
  });

  it("TC-COL-003: backoff capped at 3600 s", () => {
    expect(computeNextRunAt({ ...base, status: "failed", consecutiveFailures: 3 }).nextRunAt).toEqual(
      plus(now, MAX_FAILURE_BACKOFF_SECONDS),
    );
  });

  it("huge n does not overflow", () => {
    const r = computeNextRunAt({ ...base, status: "failed", consecutiveFailures: 10_000 });
    expect(r.nextRunAt).toEqual(plus(now, MAX_FAILURE_BACKOFF_SECONDS));
    expect(r.consecutiveFailures).toBe(10_001);
  });
});
