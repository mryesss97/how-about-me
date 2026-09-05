import { bucketInterval, previousPeriod } from "./range";

describe("range helpers", () => {
  it("previous period is the immediately preceding equal-length window", () => {
    const r = { from: new Date("2026-09-04T00:00:00+07:00"), to: new Date("2026-09-05T00:00:00+07:00") };
    const p = previousPeriod(r);
    expect(p.to.toISOString()).toBe(r.from.toISOString());
    expect(p.from.toISOString()).toBe(new Date("2026-09-03T00:00:00+07:00").toISOString());
  });
  it("buckets by hour up to 48h, else day", () => {
    const from = new Date("2026-09-01T00:00:00Z");
    expect(bucketInterval({ from, to: new Date(from.getTime() + 48 * 3600e3) })).toBe("hour");
    expect(bucketInterval({ from, to: new Date(from.getTime() + 48 * 3600e3 + 1) })).toBe("day");
  });
});
