import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  CursorPaginationQuerySchema,
  IanaTimezoneSchema,
  IsoDateTimeSchema,
  ListeningQueryListQuerySchema,
  MentionsListQuerySchema,
  RelevanceLabelSchema,
  csvArray,
  queryBoolean,
} from "../src/index.js";

describe("queryBoolean", () => {
  const s = z.object({ b: queryBoolean().default(false) });
  it.each([
    ["false", false],
    ["0", false],
    ["true", true],
    ["1", true],
    [true, true],
  ])("parses %s → %s", (input, expected) => {
    expect(s.parse({ b: input }).b).toBe(expected);
  });
  it("applies default when absent or empty", () => {
    expect(s.parse({}).b).toBe(false);
    expect(s.parse({ b: "" }).b).toBe(false);
  });
  it("rejects other values", () => {
    expect(s.safeParse({ b: "yes" }).success).toBe(false);
  });
  it("fixes count=false / enabled=false regressions", () => {
    expect(CursorPaginationQuerySchema.parse({ count: "false" }).count).toBe(false);
    expect(ListeningQueryListQuerySchema.parse({ enabled: "false" }).enabled).toBe(false);
    expect(ListeningQueryListQuerySchema.parse({}).enabled).toBeUndefined();
    expect(ListeningQueryListQuerySchema.parse({ includeDeleted: "0" }).includeDeleted).toBe(false);
  });
});

describe("csvArray", () => {
  const s = csvArray(RelevanceLabelSchema);
  it("splits comma lists and repeated keys, trims and de-dupes", () => {
    expect(s.parse("relevant,uncertain")).toEqual(["relevant", "uncertain"]);
    expect(s.parse(["relevant", "uncertain, irrelevant"])).toEqual(["relevant", "uncertain", "irrelevant"]);
    expect(s.parse("relevant,relevant")).toEqual(["relevant"]);
    expect(s.parse("")).toEqual([]);
  });
  it("rejects unknown labels and more than 50 items", () => {
    expect(s.safeParse("relevant,bogus").success).toBe(false);
    expect(csvArray(z.string()).safeParse(Array.from({ length: 51 }, (_, i) => `x${i}`)).success).toBe(false);
  });
});

describe("IsoDateTimeSchema", () => {
  it("accepts offset and Z", () => {
    expect(IsoDateTimeSchema.safeParse("2026-09-05T01:00:00+07:00").success).toBe(true);
    expect(IsoDateTimeSchema.safeParse("2026-09-05T01:00:00Z").success).toBe(true);
  });
  it("rejects date-only, slashes and missing offset", () => {
    for (const v of ["2026-09-05", "2026/09/05", "2026-09-05T01:00:00"]) {
      expect(IsoDateTimeSchema.safeParse(v).success).toBe(false);
    }
  });
});

describe("IanaTimezoneSchema", () => {
  it("validates IANA names", () => {
    expect(IanaTimezoneSchema.safeParse("Asia/Ho_Chi_Minh").success).toBe(true);
    expect(IanaTimezoneSchema.safeParse("Mars/Base").success).toBe(false);
  });
});

describe("pagination limits", () => {
  it("mentions: default 25, max 100", () => {
    expect(MentionsListQuerySchema.parse({}).limit).toBe(25);
    expect(MentionsListQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
  });
  it("queries: default 50, max 200", () => {
    expect(ListeningQueryListQuerySchema.parse({}).limit).toBe(50);
    expect(ListeningQueryListQuerySchema.parse({ limit: "200" }).limit).toBe(200);
    expect(ListeningQueryListQuerySchema.safeParse({ limit: "201" }).success).toBe(false);
  });
});
