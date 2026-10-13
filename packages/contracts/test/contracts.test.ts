import { describe, expect, it } from "vitest";
import {
  AnalysisFiltersSchema,
  CreateListeningQueryBodySchema,
  LISTENING_QUERY_IMMUTABLE_FIELDS,
  MentionsListQuerySchema,
  QueryDuplicateDetailsSchema,
  UpdateListeningQueryBodySchema,
} from "../src/index.js";

describe("listening query body (FR-052 / BR-004)", () => {
  it("strips leading # and applies defaults", () => {
    const r = CreateListeningQueryBodySchema.parse({
      displayName: "Eventista",
      queryValue: "  #Eventista ",
      queryType: "topic_tag",
    });
    expect(r.queryValue).toBe("Eventista");
    expect(r.pollIntervalSeconds).toBe(600);
    expect(r.overlapSeconds).toBe(1200);
    expect(r.enabled).toBe(true);
  });
  it("rejects out-of-range interval and too many terms", () => {
    expect(() =>
      CreateListeningQueryBodySchema.parse({
        displayName: "x",
        queryValue: "1zone",
        queryType: "keyword",
        pollIntervalSeconds: 30,
      }),
    ).toThrow();
    expect(() =>
      CreateListeningQueryBodySchema.parse({
        displayName: "x",
        queryValue: "1zone",
        queryType: "keyword",
        excludeTerms: Array(51).fill("a"),
      }),
    ).toThrow();
  });
  it("update body cannot carry immutable fields", () => {
    const r = UpdateListeningQueryBodySchema.safeParse({ queryValue: "new" });
    // unknown keys are stripped → object becomes empty → refine fails
    expect(r.success).toBe(false);
  });
  it("update body never injects defaults for unsent fields (PATCH semantics)", () => {
    const r = UpdateListeningQueryBodySchema.parse({ displayName: "Renamed" });
    expect(r).toEqual({ displayName: "Renamed" });
  });
});

describe("listening query helpers (T-042)", () => {
  it("BR-009: immutable fields are queryValue and queryType", () => {
    expect([...LISTENING_QUERY_IMMUTABLE_FIELDS]).toEqual(["queryValue", "queryType"]);
  });
  it("FR-053: duplicate details carry a uuid existingId", () => {
    expect(QueryDuplicateDetailsSchema.safeParse({ existingId: "0199a3b4-0000-7000-8000-000000000001" }).success).toBe(
      true,
    );
    expect(QueryDuplicateDetailsSchema.safeParse({ existingId: "nope" }).success).toBe(false);
  });
  it("BR-004: a value made only of # is empty after strip → rejected; >100 chars rejected", () => {
    const base = { displayName: "x", queryType: "keyword" as const };
    expect(CreateListeningQueryBodySchema.safeParse({ ...base, queryValue: "###" }).success).toBe(false);
    expect(CreateListeningQueryBodySchema.safeParse({ ...base, queryValue: "a".repeat(101) }).success).toBe(false);
  });
});

describe("filters coercion", () => {
  it("accepts comma lists and repeated keys; defaults relevance to relevant", () => {
    const r = AnalysisFiltersSchema.parse({ sentiment: "positive,negative", topic: ["ticket", "price"] });
    expect(r.sentiment).toEqual(["positive", "negative"]);
    expect(r.topic).toEqual(["ticket", "price"]);
    expect(r.relevance).toEqual(["relevant"]);
  });
  it("mentions list query defaults", () => {
    const r = MentionsListQuerySchema.parse({});
    expect(r.sort).toBe("newest");
    expect(r.limit).toBe(25);
  });
});
