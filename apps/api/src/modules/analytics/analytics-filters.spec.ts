import { AnalyticsQuerySchema } from "@how-about-me/contracts";
import { Prisma } from "@prisma/client";
import { bucketExpr, buildBaseSetCte, resolveAnalyticsQuery, timeColumn, withBase } from "./analytics-filters";

const PROJECT = { id: "11111111-1111-4111-8111-111111111111", timezone: "Asia/Ho_Chi_Minh" };
const Q1 = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-10-13T00:00:00Z");

const scopeOf = (raw: Record<string, unknown>) =>
  resolveAnalyticsQuery(AnalyticsQuerySchema.parse(raw), PROJECT, now).scope;
const norm = (s: Prisma.Sql) => s.sql.replace(/\s+/g, " ");

describe("resolveAnalyticsQuery", () => {
  it("uses project timezone and default relevance=relevant (BR-016)", () => {
    const r = resolveAnalyticsQuery(AnalyticsQuerySchema.parse({}), PROJECT, now);
    expect(r.scope.timezone).toBe("Asia/Ho_Chi_Minh");
    expect(r.scope.filters.relevance).toEqual(["relevant"]);
    expect(r.previousScope).toBeUndefined();
  });
  it("compare=true adds the preceding window (FR-141)", () => {
    const r = resolveAnalyticsQuery(
      AnalyticsQuerySchema.parse({
        from: "2026-09-04T00:00:00+07:00",
        to: "2026-09-11T00:00:00+07:00",
        compare: "true",
      }),
      PROJECT,
      now,
    );
    expect(r.previousScope?.range.to.toISOString()).toBe(r.scope.range.from.toISOString());
    expect(r.previousScope?.range.from.toISOString()).toBe(new Date("2026-08-28T00:00:00+07:00").toISOString());
  });
  it("schema rejects a 400-day range (TC-DASH-003)", () => {
    const res = AnalyticsQuerySchema.safeParse({ from: "2025-01-01T00:00:00Z", to: "2026-02-05T00:00:00Z" });
    expect(res.success).toBe(false);
  });
});

describe("buildBaseSetCte", () => {
  it("default filters: only relevance clause, [from,to) on published_at, excluded_by_terms=false (FR-147)", () => {
    const sql = norm(buildBaseSetCte(scopeOf({})));
    expect(sql).toContain("FROM effective_post_analysis e");
    expect(sql).toContain("e.published_at >= ? AND e.published_at < ?");
    expect(sql).toContain("m.excluded_by_terms = false )");
    expect(sql).toContain("e.relevance_label = ANY(?::relevance_label[])");
    expect(sql).not.toContain("m.query_id");
    expect(sql).not.toContain("sentiment_label = ANY");
    expect(sql).not.toContain("effective_post_intents");
  });

  it("queryIds produce ANY(uuid[]) inside the EXISTS (no JOIN → distinct posts)", () => {
    const s = buildBaseSetCte(scopeOf({ queryIds: Q1 }));
    expect(norm(s)).toContain("AND m.query_id = ANY(?::uuid[])");
    expect(norm(s)).not.toMatch(/JOIN/);
    expect(s.values).toContainEqual([Q1]);
  });

  it("timeField=first_seen_at switches the column", () => {
    expect(norm(buildBaseSetCte(scopeOf({ timeField: "first_seen_at" })))).toContain("e.first_seen_at >= ?");
  });

  it("labels, intents and topics are bound values, never inlined", () => {
    const s = buildBaseSetCte(
      scopeOf({
        sentiment: "negative",
        safety: "severe",
        intent: "complaint",
        topic: "payment",
        language: "vi",
        analysisStatus: "completed",
      }),
    );
    const sql = norm(s);
    for (const v of ["negative", "severe", "complaint", "payment", "'vi'", "completed"]) expect(sql).not.toContain(v);
    expect(sql).toContain("effective_post_intents i");
    expect(sql).toContain("effective_post_topics t");
    expect(sql).toContain("e.latest_run_status = ANY(?::analysis_status[])");
    expect(s.values).toEqual(expect.arrayContaining([["negative"], ["severe"], ["vi"]]));
  });

  it("language=vi → plain ANY, no taxonomy fold (FR-143)", () => {
    const sql = norm(buildBaseSetCte(scopeOf({ language: "vi" })));
    expect(sql).toContain("AND e.language_code = ANY(?)");
    expect(sql).not.toContain("IS NOT NULL");
  });

  it("language=other also matches codes outside the taxonomy, not NULL (FR-143, #201)", () => {
    const s = buildBaseSetCte(scopeOf({ language: "other" }));
    expect(norm(s)).toContain("e.language_code IS NOT NULL AND NOT (e.language_code = ANY(?::text[]))");
    expect(s.values).toContainEqual(expect.arrayContaining(["vi", "en", "other", "unknown"]));
  });

  it("ignore language drops the language filter", () => {
    expect(norm(buildBaseSetCte(scopeOf({ language: "other" }), { ignore: ["language"] }))).not.toContain(
      "language_code = ANY",
    );
  });

  it("ignore drops the relevance filter (coverage)", () => {
    expect(norm(buildBaseSetCte(scopeOf({}), { ignore: ["relevance"] }))).not.toContain("relevance_label = ANY");
  });

  it("base exposes confidence/override columns for the mentions list (T-095)", () => {
    const sql = norm(buildBaseSetCte(scopeOf({})));
    expect(sql).toContain("e.overall_model_confidence");
    expect(sql).toContain("e.has_override");
    expect(sql).toContain("e.relevance_confidence");
  });

  it("withBase prefixes WITH", () => {
    expect(withBase(scopeOf({}), Prisma.sql`SELECT count(*) FROM base`).sql.trimStart()).toMatch(/^WITH base AS/);
  });
});

describe("sql helpers", () => {
  it("bucketExpr binds timezone", () => {
    const s = bucketExpr(timeColumn("published_at"), "day", "UTC");
    expect(norm(s)).toBe("(date_trunc('day', e.published_at AT TIME ZONE ?) AT TIME ZONE ?)");
    expect(s.values).toEqual(["UTC", "UTC"]);
  });
});
