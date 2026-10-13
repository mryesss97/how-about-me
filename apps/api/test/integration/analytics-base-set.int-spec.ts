import { randomUUID } from "node:crypto";
import { AnalyticsQuerySchema } from "@how-about-me/contracts";
import type { INestApplication } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../../src/database/prisma.service";
import {
  type AnalyticsScope,
  bucketExpr,
  type IgnorableFilter,
  resolveAnalyticsQuery,
  timeColumn,
  withBase,
} from "../../src/modules/analytics/analytics-filters";
import { createTestApp, resetDb } from "../helpers/app";
import { createPost, createProject, createQuery, createUser } from "../helpers/factories";

/**
 * Analytics foundation (T-090) against a real Postgres: base set `B` over `effective_post_analysis`
 * (BR-025), DISTINCT post counting (FR-147), default relevance (BR-016), [from,to) ranges,
 * timezone bucketing and previous-period windows (FR-141) — docs/01-product/07-metric-definitions.md §0, §5.
 */
type Labels = {
  relevance?: "relevant" | "uncertain" | "irrelevant";
  sentiment?: "positive" | "neutral" | "negative";
  safety?: "safe" | "sensitive" | "severe";
  language?: string;
  intents?: string[];
  topics?: string[];
};

describe("Analytics base set (T-090)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let q1: string;
  let q2: string;
  let reviewer: string;
  const now = new Date("2026-10-13T05:00:00Z");

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    projectId = (await createProject(prisma)).id;
    q1 = (await createQuery(prisma, { projectId })).id;
    q2 = (await createQuery(prisma, { projectId })).id;
    reviewer = (await createUser(prisma)).id;
  });

  /** Post with matches (queryId → excluded_by_terms) and, unless `labels` is null, a completed current analysis. */
  async function seedPost(opts: {
    at: string;
    matches?: Record<string, boolean>;
    labels?: Labels | null;
    project?: string;
    firstSeenAt?: string;
  }) {
    const pid = opts.project ?? projectId;
    const post = await createPost(prisma, {
      projectId: pid,
      publishedAt: new Date(opts.at),
      firstSeenAt: new Date(opts.firstSeenAt ?? opts.at),
    });
    const matches = opts.matches ?? { [q1]: false };
    for (const [queryId, excludedByTerms] of Object.entries(matches)) {
      await prisma.postQueryMatch.create({
        data: { postId: post.id, queryId, excludedByTerms, firstMatchedAt: post.publishedAt, lastMatchedAt: now },
      });
    }
    if (opts.labels === null) {
      await prisma.socialPost.update({ where: { id: post.id }, data: { latestRunStatus: "pending" } });
      return post.id;
    }
    const l: Labels = { relevance: "relevant", sentiment: "neutral", safety: "safe", language: "vi", ...opts.labels };
    const runId = randomUUID();
    const analysisId = randomUUID();
    await prisma.analysisRun.create({
      data: {
        id: runId,
        postId: post.id,
        projectId: pid,
        status: "completed",
        trigger: "ingest",
        sourceContentHash: post.contentHash,
        sourceRevision: 1,
        effectiveVersion: "test-v1",
        completedAt: now,
      },
    });
    await prisma.postAnalysis.create({
      data: {
        id: analysisId,
        analysisRunId: runId,
        postId: post.id,
        projectId: pid,
        relevanceLabel: l.relevance,
        sentimentLabel: l.sentiment,
        safetyLevel: l.safety,
        languageCode: l.language,
        intents: { create: (l.intents ?? []).map((label) => ({ label })) },
        topics: { create: (l.topics ?? []).map((label) => ({ label })) },
      },
    });
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { currentAnalysisId: analysisId, latestRunStatus: "completed" },
    });
    return post.id;
  }

  function override(postId: string, field: "relevance" | "sentiment" | "safety_level", value: string, revoked = false) {
    return prisma.analysisOverride.create({
      data: {
        id: randomUUID(),
        postId,
        projectId,
        field,
        overrideValue: { value },
        reviewedBy: reviewer,
        revokedAt: revoked ? now : null,
      },
    });
  }

  const resolve = (raw: Record<string, string>, tz = "Asia/Ho_Chi_Minh") =>
    resolveAnalyticsQuery(AnalyticsQuerySchema.parse(raw), { id: projectId, timezone: tz }, now);

  async function count(scope: AnalyticsScope, ignore?: IgnorableFilter[]) {
    const rows = await prisma.$queryRaw<{ n: number; d: number }[]>(
      withBase(scope, Prisma.sql`SELECT COUNT(*)::int AS n, COUNT(DISTINCT post_id)::int AS d FROM base`, { ignore }),
    );
    const [row] = rows;
    expect(row?.n).toBe(row?.d); // base is one row per post (FR-147)
    return row?.d ?? 0;
  }

  function prev(r: { previousScope?: AnalyticsScope }): AnalyticsScope {
    if (!r.previousScope) throw new Error("expected a previous scope (compare=true)");
    return r.previousScope;
  }

  async function ids(scope: AnalyticsScope) {
    const rows = await prisma.$queryRaw<{ post_id: string }[]>(withBase(scope, Prisma.sql`SELECT post_id FROM base`));
    return rows.map((r) => r.post_id).sort();
  }

  const WEEK = { from: "2026-10-01T00:00:00+07:00", to: "2026-10-08T00:00:00+07:00" };

  it("counts a post matched by several queries once (FR-147)", async () => {
    await seedPost({ at: "2026-10-02T03:00:00Z", matches: { [q1]: false, [q2]: false } });
    await seedPost({ at: "2026-10-03T03:00:00Z", matches: { [q2]: false } });
    expect(await count(resolve(WEEK).scope)).toBe(2);
    expect(await count(resolve({ ...WEEK, queryIds: `${q1},${q2}` }).scope)).toBe(2);
    expect(await count(resolve({ ...WEEK, queryIds: q1 }).scope)).toBe(1);
  });

  it("drops posts whose only matches are excluded_by_terms; per-query exclusion respects queryIds", async () => {
    await seedPost({ at: "2026-10-02T03:00:00Z", matches: { [q1]: true } });
    await seedPost({ at: "2026-10-02T04:00:00Z", matches: { [q1]: true, [q2]: false } });
    expect(await count(resolve(WEEK).scope)).toBe(1);
    expect(await count(resolve({ ...WEEK, queryIds: q1 }).scope)).toBe(0);
    expect(await count(resolve({ ...WEEK, queryIds: q2 }).scope)).toBe(1);
  });

  it("keeps matches of soft-deleted queries when queryIds is empty (BR-010)", async () => {
    await seedPost({ at: "2026-10-02T03:00:00Z", matches: { [q2]: false } });
    await prisma.listeningQuery.update({ where: { id: q2 }, data: { deletedAt: now } });
    expect(await count(resolve(WEEK).scope)).toBe(1);
  });

  it("excludes irrelevant, uncertain and pending posts by default (BR-016) and ignore=relevance brings them back", async () => {
    await seedPost({ at: "2026-10-02T03:00:00Z" });
    await seedPost({ at: "2026-10-02T04:00:00Z", labels: { relevance: "irrelevant" } });
    await seedPost({ at: "2026-10-02T05:00:00Z", labels: { relevance: "uncertain" } });
    await seedPost({ at: "2026-10-02T06:00:00Z", labels: null });
    const scope = resolve(WEEK).scope;
    expect(await count(scope)).toBe(1);
    expect(await count(resolve({ ...WEEK, relevance: "relevant,irrelevant" }).scope)).toBe(2);
    expect(await count(scope, ["relevance"])).toBe(4);
  });

  it("uses the effective analysis: active overrides win, revoked ones do not (BR-025)", async () => {
    const promoted = await seedPost({ at: "2026-10-02T03:00:00Z", labels: { relevance: "irrelevant" } });
    const demoted = await seedPost({ at: "2026-10-02T04:00:00Z" });
    const revoked = await seedPost({ at: "2026-10-02T05:00:00Z" });
    await override(promoted, "relevance", "relevant");
    await override(demoted, "relevance", "irrelevant");
    await override(revoked, "relevance", "irrelevant", true);
    await override(revoked, "sentiment", "negative");
    expect(await ids(resolve(WEEK).scope)).toEqual([promoted, revoked].sort());
    expect(await ids(resolve({ ...WEEK, sentiment: "negative" }).scope)).toEqual([revoked]);
  });

  it("applies label, intent, topic, language, status and query filters together", async () => {
    const hit = await seedPost({
      at: "2026-10-02T03:00:00Z",
      labels: { sentiment: "negative", safety: "severe", language: "en", intents: ["complaint"], topics: ["ticket"] },
    });
    await seedPost({ at: "2026-10-02T04:00:00Z", labels: { sentiment: "negative", intents: ["praise"] } });
    await seedPost({ at: "2026-10-02T05:00:00Z", labels: { sentiment: "positive", topics: ["ticket"] } });
    const all = {
      ...WEEK,
      queryIds: q1,
      sentiment: "negative",
      safety: "severe",
      language: "en",
      intent: "complaint",
      topic: "ticket",
      analysisStatus: "completed",
    };
    expect(await ids(resolve(all).scope)).toEqual([hit]);
    expect(await count(resolve({ ...WEEK, sentiment: "negative" }).scope)).toBe(2);
    expect(await count(resolve({ ...WEEK, topic: "ticket" }).scope)).toBe(2);
    expect(await count(resolve({ ...WEEK, intent: "praise,complaint" }).scope)).toBe(2);
    expect(await count(resolve({ ...WEEK, analysisStatus: "failed" }).scope)).toBe(0);
  });

  it("scopes to the project", async () => {
    const other = (await createProject(prisma)).id;
    const oq = (await createQuery(prisma, { projectId: other })).id;
    await seedPost({ at: "2026-10-02T03:00:00Z", project: other, matches: { [oq]: false } });
    await seedPost({ at: "2026-10-02T03:00:00Z" });
    expect(await count(resolve(WEEK).scope)).toBe(1);
  });

  it("range is [from, to) on the chosen time field", async () => {
    const atFrom = await seedPost({ at: "2026-09-30T17:00:00Z" }); // 2026-10-01 00:00 +07
    await seedPost({ at: "2026-10-07T17:00:00Z" }); // 2026-10-08 00:00 +07 = to → excluded
    const lastMs = await seedPost({ at: "2026-10-07T16:59:59.999Z" });
    const seenLate = await seedPost({ at: "2026-09-20T00:00:00Z", firstSeenAt: "2026-10-02T00:00:00Z" });
    expect(await ids(resolve(WEEK).scope)).toEqual([atFrom, lastMs].sort());
    expect(await ids(resolve({ ...WEEK, timeField: "first_seen_at" }).scope)).toEqual(
      [atFrom, lastMs, seenLate].sort(),
    );
  });

  it("parses exactly what the web filter bar sends (toApiParams: UTC Z instants, CSV arrays, compare=true)", async () => {
    await seedPost({ at: "2026-10-06T00:00:00Z", labels: { sentiment: "negative" } });
    await seedPost({ at: "2026-09-30T00:00:00Z", labels: { sentiment: "negative" } });
    const r = resolve({
      compare: "true",
      from: "2026-10-06T05:00:00.000Z",
      queryIds: `${q1},${q2}`,
      relevance: "relevant",
      sentiment: "negative,positive",
      timezone: "UTC",
      to: "2026-10-13T05:00:00.000Z",
    });
    expect(r.scope.timezone).toBe("UTC");
    expect(await count(r.scope)).toBe(0);
    expect(await count(prev(r))).toBe(2);
  });

  it("default range is the last 7×24h in the project timezone when from/to are omitted", async () => {
    await seedPost({ at: "2026-10-06T05:00:00Z" }); // exactly now − 7d → included
    await seedPost({ at: "2026-10-06T04:59:59Z" });
    await seedPost({ at: "2026-10-13T05:00:00Z" }); // = now → excluded
    const r = resolve({});
    expect(r.scope.timezone).toBe("Asia/Ho_Chi_Minh");
    expect(await count(r.scope)).toBe(1);
  });

  it("previous period is the adjacent window of the same length (FR-141, §5)", async () => {
    await seedPost({ at: "2026-09-23T17:00:00Z" }); // 2026-09-24 00:00 +07 → prevFrom, included
    await seedPost({ at: "2026-09-23T16:59:59Z" }); // before prevFrom
    await seedPost({ at: "2026-09-30T16:59:59Z" }); // last second of previous window
    await seedPost({ at: "2026-10-02T00:00:00Z" }); // current window
    const r = resolve({ ...WEEK, compare: "true" });
    expect(prev(r).range).toEqual({
      from: new Date("2026-09-23T17:00:00Z"),
      to: new Date("2026-09-30T17:00:00Z"),
    });
    expect(await count(r.scope)).toBe(1);
    expect(await count(prev(r))).toBe(2);
  });

  describe("timezone day buckets", () => {
    async function buckets(scope: AnalyticsScope, interval: "hour" | "day" = "day") {
      const b = bucketExpr(timeColumn(scope.filters.timeField), interval, scope.timezone);
      const rows = await prisma.$queryRaw<{ bucket: Date; n: number }[]>(
        withBase(
          scope,
          Prisma.sql`SELECT ${b} AS bucket, COUNT(DISTINCT post_id)::int AS n
                       FROM base e GROUP BY 1 ORDER BY 1`,
        ),
      );
      return rows.map((r) => [r.bucket.toISOString(), r.n]);
    }

    beforeEach(async () => {
      await seedPost({ at: "2026-10-03T16:59:59Z" }); // 23:59:59 on 10-03 in +07, 16:59 on 10-03 in UTC
      await seedPost({ at: "2026-10-03T17:00:00Z", matches: { [q1]: false, [q2]: false } }); // 00:00 on 10-04 in +07
      await seedPost({ at: "2026-10-04T00:30:00Z" }); // 07:30 on 10-04 in +07, 00:30 on 10-04 in UTC
    });

    it("Asia/Ho_Chi_Minh splits at local midnight (17:00Z)", async () => {
      expect(await buckets(resolve(WEEK).scope)).toEqual([
        ["2026-10-02T17:00:00.000Z", 1],
        ["2026-10-03T17:00:00.000Z", 2],
      ]);
    });

    it("the Asia/Saigon alias buckets the same way", async () => {
      expect(await buckets(resolve({ ...WEEK, timezone: "Asia/Saigon" }).scope)).toEqual([
        ["2026-10-02T17:00:00.000Z", 1],
        ["2026-10-03T17:00:00.000Z", 2],
      ]);
    });

    it("UTC splits at 00:00Z", async () => {
      const scope = resolve({ from: "2026-10-01T00:00:00Z", to: "2026-10-08T00:00:00Z", timezone: "UTC" }).scope;
      expect(await buckets(scope)).toEqual([
        ["2026-10-03T00:00:00.000Z", 2],
        ["2026-10-04T00:00:00.000Z", 1],
      ]);
    });

    it("hour buckets in +07 align on the hour", async () => {
      const scope = resolve({ from: "2026-10-03T16:00:00Z", to: "2026-10-04T01:00:00Z" }).scope;
      expect(await buckets(scope, "hour")).toEqual([
        ["2026-10-03T16:00:00.000Z", 1],
        ["2026-10-03T17:00:00.000Z", 1],
        ["2026-10-04T00:00:00.000Z", 1],
      ]);
    });
  });
});
