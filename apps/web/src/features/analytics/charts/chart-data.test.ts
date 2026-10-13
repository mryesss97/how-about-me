import { describe, expect, it } from "vitest";
import { sentimentFixture, timeseriesFixture } from "../overview-fixture.test-utils";
import { bucketRange, formatBucket, hasPrevious, shareOf, toMentionsRows, toSentimentStackRows } from "./chart-data";

describe("chart-data (T-100)", () => {
  it("FR-135: formats buckets in the bucketing tz, not the browser tz (UTC 17:00 → 00:00 next day in HCM)", () => {
    expect(formatBucket("2026-10-05T17:00:00.000Z", "hour", "Asia/Ho_Chi_Minh")).toBe("00:00 06/10");
    expect(formatBucket("2026-10-05T17:00:00.000Z", "day", "Asia/Ho_Chi_Minh")).toBe("06/10");
    expect(formatBucket("2026-10-05T17:00:00.000Z", "day", "UTC")).toBe("05/10");
  });

  it("bucketRange adds 1h / 1d", () => {
    expect(bucketRange("2026-10-05T17:00:00.000Z", "hour")).toEqual({
      from: "2026-10-05T17:00:00.000Z",
      to: "2026-10-05T18:00:00.000Z",
    });
    expect(bucketRange("2026-10-05T17:00:00.000Z", "day").to).toBe("2026-10-06T17:00:00.000Z");
  });

  it("maps mention rows and detects compare data", () => {
    expect(hasPrevious(toMentionsRows(timeseriesFixture()))).toBe(false);
    const rows = toMentionsRows(timeseriesFixture(true));
    expect(rows).toHaveLength(7);
    expect(hasPrevious(rows)).toBe(true);
  });

  it("FR-136: stack rows carry a per-bucket total", () => {
    const rows = toSentimentStackRows(sentimentFixture().timeseries, "Asia/Ho_Chi_Minh");
    expect(rows.map((r) => r.total)).toEqual([35, 65]);
  });

  it("BR-032: empty input and zero denominators never throw or yield NaN", () => {
    expect(toSentimentStackRows(undefined, "UTC")).toEqual([]);
    expect(toMentionsRows({ interval: "day", timezone: "UTC", data: [] })).toEqual([]);
    expect(shareOf(3, 0)).toBeNull();
    expect(shareOf(1, 4)).toBe(0.25);
  });
});
