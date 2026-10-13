import {
  IntentsDistributionResponseSchema,
  LanguagesDistributionResponseSchema,
  MentionsPageSchema,
  OverrideSchema,
  OverviewResponseSchema,
  QueryShareResponseSchema,
  SafetyDistributionResponseSchema,
  SentimentResponseSchema,
  TimeseriesResponseSchema,
  TopicsDistributionResponseSchema,
} from "@how-about-me/contracts";
import type { INestApplication } from "@nestjs/common";
import type { PrismaService } from "../../../src/database/prisma.service";
import { ANALYTICS_EXPECTED as E } from "../../fixtures/analytics-expected";
import {
  type AnalyticsFixture,
  api,
  bucketDrill,
  createActor,
  createTestApp,
  type DrillParams,
  FIXTURE_PREVIOUS,
  FIXTURE_RANGE,
  kpiDrill,
  queryDrill,
  resetDb,
  seedAnalyticsFixture,
  segmentDrill,
} from "../../helpers";

/**
 * T-094 — shared fixture + drill-down equivalence (doc 07 §6). Every KPI / segment / query / bucket count equals
 * `totalCount` of `/mentions?count=true` with the equivalent filter. FR-141/142/143/145/147, BR-010, BR-016,
 * BR-017, BR-025; analytics QA A1–A4, A8, A9, A13–A15, A18, A20; TC-DASH-018/019/020.
 */
type Params = Record<string, string>;
const DIMS = [
  ["sentiment", "analytics/sentiment", SentimentResponseSchema],
  ["safety", "analytics/safety", SafetyDistributionResponseSchema],
  ["intent", "analytics/intents", IntentsDistributionResponseSchema],
  ["topic", "analytics/topics", TopicsDistributionResponseSchema],
  ["language", "analytics/languages", LanguagesDistributionResponseSchema],
] as const;

describe("Analytics fixture equivalence (T-094)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fx: AnalyticsFixture;
  let viewer: string;
  let analyst: string;

  const get = async (path: string, params: Params = {}, range: Params = FIXTURE_RANGE) => {
    const res = await api(app, viewer)
      .get(`/projects/${fx.projectId}/${path}`)
      .query({ ...range, ...params });
    expect(res.status).toBe(200);
    return res.body as unknown;
  };
  const overview = async (p: Params = {}) => OverviewResponseSchema.parse(await get("analytics/overview", p));
  const timeseries = async (p: Params = {}) =>
    TimeseriesResponseSchema.parse(await get("analytics/mentions-timeseries", { interval: "day", ...p }));
  const queryShare = async (p: Params = {}) => QueryShareResponseSchema.parse(await get("analytics/query-share", p));
  const dist = async (i: number, p: Params = {}) => {
    const [, path, schema] = DIMS[i] ?? DIMS[0];
    return schema.parse(await get(path, p));
  };
  const asMap = (rows: readonly { label: string; count: number }[]) =>
    Object.fromEntries(rows.filter((r) => r.count > 0).map((r) => [r.label, r.count]));
  /** `/mentions?count=true` totalCount; extra drill params override the base filters (like `toMentionsHref`). */
  const total = async (base: Params, drill: DrillParams | null, range: Params = FIXTURE_RANGE) => {
    if (!drill) throw new Error("drill-down has no filter");
    const body = MentionsPageSchema.parse(await get("mentions", { ...base, ...drill, count: "true" }, range));
    expect(body.totalCount).toBeDefined();
    return body.totalCount;
  };
  const ids = async (p: Params) => {
    const body = MentionsPageSchema.parse(await get("mentions", { ...p, limit: "100" }));
    return body.items.map((i) => i.id);
  };

  /** Full equivalence sweep for the given global filters (A13, A14, FR-145, bucket drill). */
  async function checkEquivalence(base: Params = {}) {
    const o = await overview(base);
    const k = o.kpis;
    expect(await total(base, kpiDrill("mentions"))).toBe(k.mentionCount.value);
    expect(await total(base, kpiDrill("growth"))).toBe(k.mentionCount.value);
    expect(await total(base, kpiDrill("positive"))).toBe(k.positiveRate.numerator);
    expect(await total(base, kpiDrill("negative"))).toBe(k.negativeRate.numerator);
    expect(await total(base, kpiDrill("safety"))).toBe(k.safetyRiskRate.numerator);
    expect(await total(base, kpiDrill("severe"))).toBe(k.safetyRiskRate.severeCount);
    expect(await total(base, kpiDrill("complaint"))).toBe(k.complaintRate.numerator);

    for (let i = 0; i < DIMS.length; i++) {
      const dim = DIMS[i]?.[0] ?? "sentiment";
      for (const row of (await dist(i, base)).distribution) {
        const drill = segmentDrill(dim, row.label);
        if (!drill) continue; // topic "other" has no filter (doc 07 §6)
        expect([dim, row.label, await total(base, drill)]).toEqual([dim, row.label, row.count]);
      }
    }
    for (const row of (await queryShare(base)).distribution) {
      expect(await total(base, queryDrill(row.queryId))).toBe(row.count);
    }
    const ts = await timeseries(base);
    const times = ts.data.map((d) => d.time);
    for (let i = 0; i < ts.data.length; i++) {
      const drill = bucketDrill(times, i, FIXTURE_RANGE);
      if (!drill) continue;
      expect([times[i], await total(base, {}, drill)]).toEqual([times[i], ts.data[i]?.mentions]);
    }
    return o;
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  describe("read-only (seeded once)", () => {
    beforeAll(async () => {
      await resetDb(prisma);
      fx = await seedAnalyticsFixture(prisma);
      viewer = (await createActor(prisma, { projectId: fx.projectId, role: "viewer" })).token;
    });

    it("overview matches expected KPIs, coverage and metricsVersion (A1, A3, A4, A20, BR-017)", async () => {
      const o = await overview({ compare: "true" });
      expect(o.meta.metricsVersion).toBe(E.overview.metricsVersion);
      expect(o.kpis.mentionCount).toEqual({
        value: E.overview.mentionCount,
        previous: E.overview.previous,
        growthPct: E.overview.growthPct,
        growthState: E.overview.growthState,
      });
      expect(o.kpis.positiveRate).toMatchObject(E.overview.positive);
      expect(o.kpis.negativeRate).toMatchObject(E.overview.negative);
      expect(o.kpis.safetyRiskRate).toMatchObject(E.overview.safetyRisk);
      expect(o.kpis.complaintRate).toMatchObject(E.overview.complaint);
      expect(o.coverage).toEqual(E.overview.coverage);
      expect(Date.parse(o.range.previous?.from ?? "")).toBe(Date.parse(FIXTURE_PREVIOUS.from));
    });

    it("distributions, query share and timeseries match expected numbers (A2, A5, A15, FR-143, FR-145)", async () => {
      const [sentiment, safety, intents, topics, languages] = await Promise.all(DIMS.map((_, i) => dist(i)));
      expect(asMap(sentiment?.distribution ?? [])).toEqual(E.sentiment);
      expect(asMap(safety?.distribution ?? [])).toEqual(E.safety);
      expect(asMap(intents?.distribution ?? [])).toEqual(E.intents);
      expect(intents?.denominator).toBe(E.intentsDenominator); // Σ intents 9 > 8 → shares overlap (A5)
      expect(asMap(topics?.distribution ?? [])).toEqual(E.topics);
      expect(asMap(languages?.distribution ?? [])).toEqual(E.languages);

      const qs = await queryShare();
      const byId = Object.fromEntries(qs.distribution.map((r) => [r.queryId, r.count]));
      expect(byId).toEqual({ [fx.q1]: E.queryShare.q1, [fx.q2]: E.queryShare.q2 });
      expect(qs.denominator).toBe(E.overview.mentionCount);

      const ts = await timeseries();
      expect(ts.data.map((d) => d.mentions)).toEqual(E.timeseriesDay);
    });

    it("cross-endpoint totals agree with /mentions count (A1, A15, FR-147)", async () => {
      const o = await overview();
      const n = o.kpis.mentionCount.value;
      const ts = await timeseries();
      expect(ts.data.reduce((s, d) => s + d.mentions, 0)).toBe(n);
      expect((await dist(0)).denominator).toBe(n);
      expect((await queryShare()).denominator).toBe(n);
      expect((await dist(4)).distribution.reduce((s, r) => s + r.count, 0)).toBe(n);
      expect(await total({}, {})).toBe(n);
    });

    it("every KPI / segment / query / bucket drills down to the same count (A13, A14, TC-DASH-018/019)", async () => {
      await checkEquivalence();
      expect(await total({}, { sentiment: "negative", topic: "ticket" })).toBe(E.combos.negativeTicket);
    });

    it("previous period drills to the previous count (FR-141)", async () => {
      expect(await total({}, {}, FIXTURE_PREVIOUS)).toBe(E.overview.previous);
    });

    it("relevance=irrelevant: every endpoint and the list agree (A8, TC-DASH-020, BR-016, BR-025)", async () => {
      const p = { relevance: "irrelevant" };
      const o = await checkEquivalence(p);
      expect(o.kpis.mentionCount.value).toBe(E.irrelevant);
      expect((await ids(p)).sort()).toEqual([fx.postIds.P09, fx.postIds.P10].sort());
      const def = await ids({});
      expect(def).not.toContain(fx.postIds.P09);
      expect(def).not.toContain(fx.postIds.P10);
      expect(def).not.toContain(fx.postIds.P15); // uncertain
    });

    it("excluded-by-terms matches are not counted (A18, BR-010)", async () => {
      const def = await ids({});
      expect(def).not.toContain(fx.postIds.P11);
      expect(await ids(queryDrill(fx.q1))).not.toContain(fx.postIds.P12);
      expect(await ids(queryDrill(fx.q2))).toContain(fx.postIds.P12);
    });

    it("range is [from, to) and buckets follow the timezone (A15, A16)", async () => {
      const def = await ids({});
      expect(def).toContain(fx.postIds.P07); // from inclusive
      expect(def).not.toContain(fx.postIds.P08); // to exclusive
      const utc = await timeseries({ timezone: "UTC" });
      expect(utc.data.map((d) => d.mentions)).toEqual(E.timeseriesDayUtc);
      const times = utc.data.map((d) => d.time);
      for (let i = 0; i < times.length; i++) {
        const drill = bucketDrill(times, i, FIXTURE_RANGE);
        if (drill) expect(await total({}, {}, drill)).toBe(utc.data[i]?.mentions);
      }
    });

    it("other project data does not leak (X01 scoping)", async () => {
      const o = await overview();
      expect(o.kpis.safetyRiskRate.severeCount).toBe(E.overview.safetyRisk.severeCount);
      expect(o.kpis.mentionCount.value).toBe(E.overview.mentionCount);
    });
  });

  describe("overrides (A9, BR-025)", () => {
    beforeEach(async () => {
      await resetDb(prisma);
      fx = await seedAnalyticsFixture(prisma);
      viewer = (await createActor(prisma, { projectId: fx.projectId, role: "viewer" })).token;
      analyst = (await createActor(prisma, { projectId: fx.projectId, role: "analyst" })).token;
    });

    it("override P04 negative→neutral keeps equivalence; revoke restores expected numbers", async () => {
      const before = await checkEquivalence();
      const ov = `/projects/${fx.projectId}/mentions/${fx.postIds.P04}/overrides`;
      const created = OverrideSchema.parse(
        (await api(app, analyst).post(ov, { field: "sentiment", value: "neutral" }).expect(201)).body,
      );
      const during = await checkEquivalence();
      expect(during.kpis.negativeRate.numerator).toBe(E.withP04Override.negative);
      expect(asMap((await dist(0)).distribution)).toMatchObject({ neutral: E.withP04Override.neutral });

      await api(app, analyst).delete(`${ov}/${created.id}`).expect(204);
      const after = await checkEquivalence();
      expect(after.kpis).toEqual(before.kpis);
      expect(after.kpis.negativeRate.numerator).toBe(E.overview.negative.numerator);
    });
  });
});
