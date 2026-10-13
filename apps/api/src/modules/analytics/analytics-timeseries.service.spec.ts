import { alignSeries, chooseInterval } from "./analytics-timeseries.service";

/** T-092 pure helpers — TC-DASH-002 (interval), FR-141 (previous alignment by offset). */
describe("analytics timeseries helpers", () => {
  const from = new Date("2026-10-01T00:00:00Z");
  const at = (ms: number) => ({ from, to: new Date(from.getTime() + ms) });
  const H = 3_600_000;

  it("TC-DASH-002: 48 h → hour, 48 h + 1 ms → day", () => {
    expect(chooseInterval(at(48 * H))).toBe("hour");
    expect(chooseInterval(at(48 * H + 1))).toBe("day");
  });

  it("override: day always allowed; hour allowed ≤ 31 d, rejected beyond", () => {
    expect(chooseInterval(at(2 * H), "day")).toBe("day");
    expect(chooseInterval(at(31 * 24 * H), "hour")).toBe("hour");
    expect(() => chooseInterval(at(31 * 24 * H + 1), "hour")).toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR" }),
    );
  });

  const b = (iso: string, n: number) => ({ bucket: new Date(iso), n });
  const cur = [b("2026-10-01T17:00:00Z", 3), b("2026-10-02T17:00:00Z", 0)];

  it("FR-141: previous aligned by index; shorter → 0, longer → dropped", () => {
    expect(alignSeries(cur, [b("2026-09-29T17:00:00Z", 5)], "Asia/Ho_Chi_Minh")).toEqual([
      { time: "2026-10-02T00:00:00+07:00", mentions: 3, previous: 5 },
      { time: "2026-10-03T00:00:00+07:00", mentions: 0, previous: 0 },
    ]);
    const longer = [b("2026-09-29T17:00:00Z", 1), b("2026-09-30T17:00:00Z", 2), b("2026-10-01T00:00:00Z", 9)];
    expect(alignSeries(cur, longer, "Asia/Ho_Chi_Minh").map((p) => p.previous)).toEqual([1, 2]);
  });

  it("no compare → no `previous` key", () => {
    for (const p of alignSeries(cur, undefined, "Asia/Ho_Chi_Minh")) expect(p).not.toHaveProperty("previous");
  });
});
