import { AppError } from "../errors/app.error";
import { bucketInterval, formatInTz, previousPeriod, previousPeriodInTz, resolveRange, toRangeDto } from "./range";

const HCM = "Asia/Ho_Chi_Minh";
const NY = "America/New_York";
const iso = (d: Date) => d.toISOString();

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

describe("resolveRange", () => {
  const now = new Date("2026-10-13T05:30:00Z");
  const ctx = { projectTimezone: HCM, now };

  it("defaults to [now − 7×24h, now) and the project timezone", () => {
    const r = resolveRange({}, ctx);
    expect(iso(r.to)).toBe(iso(now));
    expect(iso(r.from)).toBe("2026-10-06T05:30:00.000Z");
    expect(r.timezone).toBe(HCM);
    expect(r.previous).toBeUndefined();
  });

  it("derives the missing end ±7×24h", () => {
    expect(iso(resolveRange({ from: "2026-09-01T00:00:00Z" }, ctx).to)).toBe("2026-09-08T00:00:00.000Z");
    expect(iso(resolveRange({ to: "2026-09-08T00:00:00Z" }, ctx).from)).toBe("2026-09-01T00:00:00.000Z");
  });

  it("accepts exactly 366 days and rejects 366 days + 1ms (TC-DASH-003)", () => {
    const from = "2025-01-01T00:00:00.000Z";
    const to366 = new Date(Date.parse(from) + 366 * 86_400_000);
    expect(() => resolveRange({ from, to: iso(to366) }, ctx)).not.toThrow();
    const tooLong = new Date(to366.getTime() + 1);
    expect(() => resolveRange({ from, to: iso(tooLong) }, ctx)).toThrow(AppError);
    try {
      resolveRange({ from, to: iso(tooLong) }, ctx);
    } catch (e: unknown) {
      expect(e instanceof AppError && e.code).toBe("VALIDATION_ERROR");
    }
  });

  it("rejects to == from", () => {
    expect(() => resolveRange({ from: "2026-09-01T00:00:00Z", to: "2026-09-01T00:00:00Z" }, ctx)).toThrow(AppError);
  });

  it("timezone change shifts previous window (TC-DASH-004, FR-141)", () => {
    const hcm = resolveRange(
      { from: "2026-09-04T00:00:00+07:00", to: "2026-09-11T00:00:00+07:00", timezone: HCM, compare: true },
      ctx,
    );
    expect(iso(hcm.previous?.from ?? new Date(NaN))).toBe(iso(new Date("2026-08-28T00:00:00+07:00")));
    const utc = resolveRange(
      { from: "2026-09-04T00:00:00Z", to: "2026-09-11T00:00:00Z", timezone: "UTC", compare: true },
      ctx,
    );
    expect(iso(utc.previous?.from ?? new Date(NaN))).toBe("2026-08-28T00:00:00.000Z");
    expect(iso(utc.previous?.to ?? new Date(NaN))).toBe("2026-09-04T00:00:00.000Z");
  });
});

describe("previousPeriodInTz", () => {
  it("steps whole local days across DST (America/New_York, 2026-11-01)", () => {
    // [Nov 4 00:00 EST, Nov 11 00:00 EST) — previous spans the DST change, length ≠ 168h.
    const r = { from: new Date("2026-11-04T00:00:00-05:00"), to: new Date("2026-11-11T00:00:00-05:00") };
    const p = previousPeriodInTz(r, NY);
    expect(iso(p.from)).toBe(iso(new Date("2026-10-28T00:00:00-04:00")));
    expect(iso(p.to)).toBe(iso(r.from));
    expect(p.to.getTime() - p.from.getTime()).toBe(169 * 3600e3);
  });

  it("range containing DST still steps 7 calendar days", () => {
    const r = { from: new Date("2026-10-29T00:00:00-04:00"), to: new Date("2026-11-05T00:00:00-05:00") };
    const p = previousPeriodInTz(r, NY);
    expect(iso(p.from)).toBe(iso(new Date("2026-10-22T00:00:00-04:00")));
  });

  it("non-midnight range steps back by ms", () => {
    const r = { from: new Date("2026-09-04T12:00:00+07:00"), to: new Date("2026-09-05T12:00:00+07:00") };
    expect(iso(previousPeriodInTz(r, HCM).from)).toBe(iso(new Date("2026-09-03T12:00:00+07:00")));
  });

  it("midnight in UTC is not midnight in HCM → ms fallback gives same length", () => {
    const r = { from: new Date("2026-09-04T00:00:00Z"), to: new Date("2026-09-06T00:00:00Z") };
    expect(iso(previousPeriodInTz(r, HCM).from)).toBe("2026-09-02T00:00:00.000Z");
  });
});

describe("formatInTz / toRangeDto", () => {
  it("renders the timezone offset", () => {
    const d = new Date("2026-09-04T00:00:00+07:00");
    expect(formatInTz(d, HCM)).toBe("2026-09-04T00:00:00+07:00");
    expect(formatInTz(d, "UTC")).toBe("2026-09-03T17:00:00+00:00");
    expect(toRangeDto({ from: d, to: d }, NY).from).toBe("2026-09-03T13:00:00-04:00");
  });
});
