import { describe, expect, it } from "vitest";
import { queryFixture } from "./fixtures.test-utils";
import { emptyValues, serverIssuesToErrors, toCreateBody, toUpdateBody, validate, valuesFromQuery } from "./query-form";

const valid = () => ({ ...emptyValues(), displayName: "Eventista", queryValue: "eventista" });

describe("query-form validate (FR-052)", () => {
  it("defaults come from the contract: 600 / 1200 / 1 / enabled", () => {
    expect(emptyValues()).toMatchObject({
      pollIntervalSeconds: "600",
      overlapSeconds: "1200",
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
    ["59", true],
    ["60", false],
    ["86400", false],
    ["86401", true],
    ["", true],
    ["abc", true],
  ])("pollIntervalSeconds %s", (v, bad) => {
    expect(!!validate({ ...valid(), pollIntervalSeconds: v }, "create").pollIntervalSeconds).toBe(bad);
  });

  it("overlap -1 and backfill 31 are rejected", () => {
    const e = validate({ ...valid(), overlapSeconds: "-1", initialBackfillDays: "31" }, "create");
    expect(e.overlapSeconds).toBeDefined();
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
    expect(toCreateBody({ ...valid(), overlapSeconds: "" })).toBeNull();
  });
});

describe("toUpdateBody (FR-054, BR-009)", () => {
  const q = queryFixture({ displayName: "A", pollIntervalSeconds: 600 });
  it("unchanged → null", () => {
    expect(toUpdateBody(valuesFromQuery(q), q)).toBeNull();
  });
  it("only changed fields, never queryValue/queryType", () => {
    const body = toUpdateBody(
      { ...valuesFromQuery(q), displayName: "B", pollIntervalSeconds: "300", queryValue: "x", queryType: "topic_tag" },
      q,
    );
    expect(body).toEqual({ displayName: "B", pollIntervalSeconds: 300 });
  });
});

describe("serverIssuesToErrors", () => {
  it("maps dotted paths to fields", () => {
    const e = serverIssuesToErrors({ issues: [{ path: "excludeTerms.2", message: "x", code: "too_big" }] });
    expect(Object.keys(e)).toEqual(["excludeTerms"]);
    expect(serverIssuesToErrors(null)).toEqual({});
  });
});
