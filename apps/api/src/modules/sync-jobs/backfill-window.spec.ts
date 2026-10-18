import { assertBackfillWindow } from "./backfill-window";

/** T-140 / FR-063: backfill window rules → BACKFILL_WINDOW_INVALID. */
describe("assertBackfillWindow (FR-063)", () => {
  const now = new Date("2026-10-18T00:00:00Z");
  const since = new Date("2026-08-01T00:00:00Z");
  const at = (ms: number) => new Date(since.getTime() + ms);
  const DAY = 86_400_000;
  const check = (s: Date, u: Date) => () => assertBackfillWindow(s, u, now, 30);
  const invalid = expect.objectContaining({ code: "BACKFILL_WINDOW_INVALID" });

  it("valid window passes", () => expect(check(since, at(DAY))).not.toThrow());
  it("until == since → invalid", () => expect(check(since, since)).toThrow(invalid));
  it("until < since → invalid", () => expect(check(since, at(-1))).toThrow(invalid));
  it("exactly maxDays → ok", () => expect(check(since, at(30 * DAY))).not.toThrow());
  it("maxDays + 1s → invalid", () => expect(check(since, at(30 * DAY + 1000))).toThrow(invalid));
  it("until in the future (beyond skew) → invalid", () =>
    expect(check(new Date(now.getTime() - DAY), new Date(now.getTime() + 120_000))).toThrow(invalid));
  it("until within 60s skew → ok", () =>
    expect(check(new Date(now.getTime() - DAY), new Date(now.getTime() + 30_000))).not.toThrow());
});
