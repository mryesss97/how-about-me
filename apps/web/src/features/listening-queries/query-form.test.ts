import { describe, expect, it } from "vitest";
import { queryFixture } from "./fixtures.test-utils";
import {
  emptyValues,
  serverIssuesToErrors,
  suggestDisplayName,
  toCreateBody,
  toUpdateBody,
  validate,
  valuesFromQuery,
} from "./query-form";

const valid = () => ({ ...emptyValues(), displayName: "Eventista", queryValue: "eventista" });

describe("query-form validate (FR-052)", () => {
  it("defaults come from the contract: 600 / 1200 s shown as 10 / 20 min (#341)", () => {
    expect(emptyValues()).toMatchObject({
      pollIntervalMinutes: "10",
      overlapMinutes: "20",
      initialBackfillDays: "1",
      enabled: true,
    });
    expect(validate(valid(), "create")).toEqual({});
  });

  it.each([
    ["", true],
    ["a", false],
    ["a".repeat(80), false],
    ["a".repeat(81), true],
  ])("displayName length %#", (name, bad) => {
    expect(!!validate({ ...valid(), displayName: name }, "create").displayName).toBe(bad);
  });

  it.each([
    ["0", true],
    ["1", false],
    ["1440", false],
    ["1441", true],
    ["1,5", true],
    ["1.5", true],
    ["", true],
    ["abc", true],
  ])("#341: pollIntervalMinutes %s", (v, bad) => {
    expect(!!validate({ ...valid(), pollIntervalMinutes: v }, "create").pollIntervalMinutes).toBe(bad);
  });

  it("#341: interval message is in minutes; overlap 0 is valid", () => {
    expect(validate({ ...valid(), pollIntervalMinutes: "0" }, "create").pollIntervalMinutes).toBe(
      "Chu kỳ quét 1–1440 phút.",
    );
    expect(validate({ ...valid(), overlapMinutes: "0" }, "create")).toEqual({});
  });

  it("overlap -1 and backfill 31 are rejected", () => {
    const e = validate({ ...valid(), overlapMinutes: "-1", initialBackfillDays: "31" }, "create");
    expect(e.overlapMinutes).toBeDefined();
    expect(e.initialBackfillDays).toBe("Lấy dữ liệu cũ 0–30 ngày.");
  });

  it("51 terms or a 101-char term are rejected", () => {
    const many = Array.from({ length: 51 }, (_, i) => `t${i}`);
    expect(validate({ ...valid(), excludeTerms: many }, "create").excludeTerms).toBeDefined();
    expect(validate({ ...valid(), includeTerms: ["x".repeat(101)] }, "create").includeTerms).toBeDefined();
  });

  it("queryValue '#' only is invalid in create, ignored in edit (FR-054)", () => {
    expect(validate({ ...valid(), queryValue: "#" }, "create").queryValue).toBeDefined();
    expect(validate({ ...valid(), queryValue: "" }, "edit")).toEqual({});
  });
});

describe("toCreateBody", () => {
  it("BR-004: strips the leading #", () => {
    expect(toCreateBody({ ...valid(), queryValue: "#eventista" })?.queryValue).toBe("eventista");
  });
  it("returns null on invalid numbers (never NaN)", () => {
    expect(toCreateBody({ ...valid(), overlapMinutes: "" })).toBeNull();
  });
  it("#341: minutes are sent as seconds", () => {
    expect(toCreateBody(valid())).toMatchObject({ pollIntervalSeconds: 600, overlapSeconds: 1200 });
  });
});

describe("toUpdateBody (FR-054, BR-009)", () => {
  const q = queryFixture({ displayName: "A", pollIntervalSeconds: 600 });
  it("unchanged → null", () => {
    expect(toUpdateBody(valuesFromQuery(q), q)).toBeNull();
  });
  it("only changed fields, never queryValue/queryType", () => {
    const body = toUpdateBody(
      { ...valuesFromQuery(q), displayName: "B", pollIntervalMinutes: "5", queryValue: "x", queryType: "topic_tag" },
      q,
    );
    expect(body).toEqual({ displayName: "B", pollIntervalSeconds: 300 });
  });
  it("#341: 1800 s shows as 30 min", () => {
    expect(valuesFromQuery(queryFixture({ pollIntervalSeconds: 1800 })).pollIntervalMinutes).toBe("30");
  });
  it("#341: an untouched legacy 90 s value stays valid and sends no diff", () => {
    const legacy = queryFixture({ pollIntervalSeconds: 90 });
    const v = valuesFromQuery(legacy);
    expect(v.pollIntervalMinutes).toBe("1,5");
    expect(validate(v, "edit", legacy)).toEqual({});
    expect(toUpdateBody(v, legacy)).toBeNull();
    expect(toUpdateBody({ ...v, pollIntervalMinutes: "2" }, legacy)).toEqual({ pollIntervalSeconds: 120 });
  });
});

describe("serverIssuesToErrors", () => {
  it("maps dotted paths to fields", () => {
    const e = serverIssuesToErrors({ issues: [{ path: "excludeTerms.2", message: "x", code: "too_big" }] });
    expect(Object.keys(e)).toEqual(["excludeTerms"]);
    expect(serverIssuesToErrors(null)).toEqual({});
  });
  it("#341: seconds paths map to the minute fields", () => {
    const e = serverIssuesToErrors({ issues: [{ path: "pollIntervalSeconds", message: "x", code: "too_small" }] });
    expect(e).toEqual({ pollIntervalMinutes: "Chu kỳ quét 1–1440 phút." });
  });
});

describe("suggestDisplayName (#341)", () => {
  it("BR-004: drops the leading #", () => {
    expect(suggestDisplayName(" #eventista ")).toBe("eventista");
  });
});
