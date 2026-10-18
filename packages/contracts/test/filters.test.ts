import { describe, expect, it } from "vitest";
import {
  AnalysisFiltersSchema,
  AnalysisRunsListQuerySchema,
  AnalyticsQuerySchema,
  AuditLogsQuerySchema,
  BulkReanalyzeBodySchema,
  CreateOverrideBodySchema,
  isUnlabelledStatusFilter,
  MentionsListQuerySchema,
  RetryFailedBodySchema,
  SyncJobsListQuerySchema,
} from "../src/index.js";

const FROM = "2026-01-01T00:00:00Z";

describe("date range", () => {
  const schemas = {
    AnalysisFiltersSchema,
    AnalyticsQuerySchema,
    MentionsListQuerySchema,
    SyncJobsListQuerySchema,
    AuditLogsQuerySchema,
    AnalysisRunsListQuerySchema,
  };
  for (const [name, s] of Object.entries(schemas)) {
    it(`${name}: rejects to <= from and span > 366 days; accepts only from`, () => {
      const eq = s.safeParse({ from: FROM, to: FROM });
      expect(eq.success).toBe(false);
      expect(eq.error?.issues[0]?.path).toEqual(["to"]);
      expect(s.safeParse({ from: FROM, to: "2027-01-03T00:00:00Z" }).success).toBe(false);
      expect(s.safeParse({ from: FROM, to: "2027-01-02T00:00:00Z" }).success).toBe(true);
      expect(s.safeParse({ from: FROM }).success).toBe(true);
    });
  }
});

describe("BR-016: relevance defaults to relevant", () => {
  it.each([
    ["filters", AnalysisFiltersSchema],
    ["analytics", AnalyticsQuerySchema],
    ["mentions", MentionsListQuerySchema],
    ["bulk reanalyze", BulkReanalyzeBodySchema],
  ] as const)("%s", (_, s) => {
    expect(s.parse({}).relevance).toEqual(["relevant"]);
  });
});

describe("mentions query", () => {
  it("reviewStatus accepts a list", () => {
    expect(MentionsListQuerySchema.parse({ reviewStatus: "reviewed,unreviewed" }).reviewStatus).toEqual([
      "reviewed",
      "unreviewed",
    ]);
  });
  it("analytics compare=false stays false", () => {
    expect(AnalyticsQuerySchema.parse({ compare: "false" }).compare).toBe(false);
  });
});

describe("override body (P1)", () => {
  it("accepts matching field/value", () => {
    expect(CreateOverrideBodySchema.safeParse({ field: "sentiment", value: "negative" }).success).toBe(true);
    expect(CreateOverrideBodySchema.safeParse({ field: "topics", value: ["ticket"] }).success).toBe(true);
  });
  it("rejects field/value mismatch and long reason", () => {
    expect(CreateOverrideBodySchema.safeParse({ field: "sentiment", value: "ticket" }).success).toBe(false);
    expect(CreateOverrideBodySchema.safeParse({ field: "intents", value: "complaint" }).success).toBe(false);
    expect(
      CreateOverrideBodySchema.safeParse({ field: "relevance", value: "relevant", reason: "x".repeat(501) }).success,
    ).toBe(false);
  });
});

describe("bulk/retry bodies", () => {
  it("dryRun defaults false; retry-failed limit 1..500 default 100", () => {
    expect(BulkReanalyzeBodySchema.parse({}).dryRun).toBe(false);
    expect(RetryFailedBodySchema.parse({}).limit).toBe(100);
    expect(RetryFailedBodySchema.safeParse({ limit: 501 }).success).toBe(false);
  });
});

// FR-148, BR-041: `phrase` filter is normalised server-side and shared by analytics + mentions.
describe("phrase filter (FR-148, BR-041)", () => {
  it("normalises CSV values and defaults to []", () => {
    expect(AnalysisFiltersSchema.parse({}).phrase).toEqual([]);
    expect(AnalyticsQuerySchema.parse({ phrase: "Giá Vé,check-in" }).phrase).toEqual(["giá vé", "check-in"]);
    expect(MentionsListQuerySchema.parse({ phrase: "  App   Lỗi " }).phrase).toEqual(["app lỗi"]);
  });
  it("rejects too long or empty-after-normalise values", () => {
    expect(AnalysisFiltersSchema.safeParse({ phrase: "a".repeat(61) }).success).toBe(false);
    expect(AnalysisFiltersSchema.safeParse({ phrase: "🔥" }).success).toBe(false);
  });
});

// BR-042, #273: scalar `term` filter normalised with BR-041.
describe("term filter (BR-042, #273)", () => {
  it("normalises and is optional", () => {
    expect(AnalysisFiltersSchema.parse({}).term).toBeUndefined();
    expect(AnalyticsQuerySchema.parse({ term: "  Giá Vé " }).term).toBe("giá vé");
    expect(MentionsListQuerySchema.parse({ term: "Giá,vé" }).term).toBe("giá vé");
  });
  it("rejects empty, no letter/digit, and >60 chars", () => {
    for (const term of ["", "   ", "!!!", "a".repeat(61)]) {
      expect(AnalysisFiltersSchema.safeParse({ term }).success).toBe(false);
    }
  });
});

describe("isUnlabelledStatusFilter (BR-016 exception, #328)", () => {
  it.each([[["pending"]], [["pending", "processing"]], [["failed"]]] as const)("%j → true", (v) => {
    expect(isUnlabelledStatusFilter(v)).toBe(true);
  });
  it.each([[[]], [["pending", "completed"]], [["skipped"]], [["stale"]]] as const)("%j → false", (v) => {
    expect(isUnlabelledStatusFilter(v)).toBe(false);
  });
});
