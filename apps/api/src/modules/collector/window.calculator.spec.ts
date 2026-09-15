import { computeWindow, windowSeconds, type WindowConfig, type WindowQueryState } from "./window.calculator";

const CFG: WindowConfig = { maxWindowDays: 30 };
const NOW = new Date("2026-09-15T10:00:00.000Z");
const HOUR = 3_600_000;
const DAY = 86_400_000;

const query = (over: Partial<WindowQueryState> = {}): WindowQueryState => ({
  lastSuccessfulSyncAt: null,
  overlapSeconds: 1200,
  initialBackfillDays: 1,
  ...over,
});

describe("computeWindow (FR-072, BR-011)", () => {
  it("TC-COL-004: first run uses initialBackfillDays and ends at now", () => {
    const w = computeWindow(query({ initialBackfillDays: 1 }), NOW, CFG);
    expect(w.until.toISOString()).toBe(NOW.toISOString());
    expect(w.since.toISOString()).toBe(new Date(NOW.getTime() - DAY).toISOString());
    expect(w.reason).toBe("first_run");
  });

  it("first run with initialBackfillDays = 0 falls back to one day", () => {
    const w = computeWindow(query({ initialBackfillDays: 0 }), NOW, CFG);
    expect(windowSeconds(w)).toBe(86_400);
  });

  it("TC-COL-005: incremental run subtracts the overlap from lastSuccessfulSyncAt", () => {
    const last = new Date(NOW.getTime() - 10 * 60_000); // T = now − 10 min
    const w = computeWindow(query({ lastSuccessfulSyncAt: last, overlapSeconds: 1200 }), NOW, CFG);
    expect(w.since.toISOString()).toBe(new Date(last.getTime() - 1200 * 1000).toISOString());
    expect(w.reason).toBe("overlap");
  });

  it("overlap larger than the poll interval simply widens the window (BR-013 duplicates are expected)", () => {
    const last = new Date(NOW.getTime() - 600 * 1000); // one poll interval ago
    const w = computeWindow(query({ lastSuccessfulSyncAt: last, overlapSeconds: 3600 }), NOW, CFG);
    expect(w.since.getTime()).toBeLessThan(last.getTime());
    expect(windowSeconds(w)).toBe(600 + 3600);
  });

  it("overlap = 0 reduces the window to the time since the last sync", () => {
    const last = new Date(NOW.getTime() - 5 * 60_000);
    const w = computeWindow(query({ lastSuccessfulSyncAt: last, overlapSeconds: 0 }), NOW, CFG);
    expect(w.since.toISOString()).toBe(last.toISOString());
    expect(windowSeconds(w)).toBe(300);
  });

  it("TC-COL-006: a long outage is clamped to COLLECTOR_MAX_WINDOW_DAYS", () => {
    const last = new Date(NOW.getTime() - 60 * DAY);
    const w = computeWindow(query({ lastSuccessfulSyncAt: last, overlapSeconds: 1200 }), NOW, CFG);
    expect(w.since.toISOString()).toBe(new Date(NOW.getTime() - 30 * DAY).toISOString());
    expect(w.reason).toBe("clamped");
  });

  it("clamps the first run too when initialBackfillDays exceeds the max window", () => {
    const w = computeWindow(query({ initialBackfillDays: 30 }), NOW, { maxWindowDays: 7 });
    expect(w.since.toISOString()).toBe(new Date(NOW.getTime() - 7 * DAY).toISOString());
    expect(w.reason).toBe("clamped");
  });

  it("clock skew: a lastSuccessfulSyncAt in the future yields since = until − overlap, never since > until", () => {
    const last = new Date(NOW.getTime() + 2 * HOUR);
    const w = computeWindow(query({ lastSuccessfulSyncAt: last, overlapSeconds: 1200 }), NOW, CFG);
    expect(w.since.getTime()).toBeLessThanOrEqual(w.until.getTime());
    expect(w.since.toISOString()).toBe(new Date(NOW.getTime() - 1200 * 1000).toISOString());
    expect(w.reason).toBe("clock_skew");
  });

  it("is pure: it never mutates the inputs", () => {
    const last = new Date(NOW.getTime() - HOUR);
    const q = query({ lastSuccessfulSyncAt: last });
    const nowCopy = new Date(NOW.getTime());
    computeWindow(q, nowCopy, CFG);
    expect(q.lastSuccessfulSyncAt?.toISOString()).toBe(last.toISOString());
    expect(nowCopy.toISOString()).toBe(NOW.toISOString());
  });
});
