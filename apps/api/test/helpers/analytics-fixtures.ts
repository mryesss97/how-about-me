import { randomUUID } from "node:crypto";
import type { PrismaService } from "../../src/database/prisma.service";
import { createPost, createProject, createQuery, createUser } from "./factories";

/**
 * T-094 shared analytics fixture — deterministic dataset covering multi-query, pending/failed, irrelevant,
 * excluded terms, overrides and timezone boundaries. Table + expected numbers:
 * docs/04-qa/02-analytics-qa-checklist.md "Fixture dataset & expected numbers"; numbers in
 * test/fixtures/analytics-expected.ts.
 */
export const FIXTURE_TZ = "Asia/Ho_Chi_Minh";
export const FIXTURE_RANGE = { from: "2026-10-05T00:00:00+07:00", to: "2026-10-12T00:00:00+07:00" } as const;
export const FIXTURE_PREVIOUS = { from: "2026-09-28T00:00:00+07:00", to: "2026-10-05T00:00:00+07:00" } as const;

type Labels = {
  relevance?: "relevant" | "uncertain" | "irrelevant";
  sentiment?: "positive" | "neutral" | "negative";
  safety?: "safe" | "sensitive" | "severe";
  language?: string;
  intents?: string[];
  topics?: string[];
};

type PostSpec = {
  at: string;
  /** query key → excluded_by_terms */
  matches: Partial<Record<"q1" | "q2", boolean>>;
  labels?: Labels;
  status?: "pending" | "failed";
  /** AI value overridden by analyst (BR-025); revoked overrides must not take effect. */
  override?: { field: "relevance" | "sentiment"; value: string; revoked?: boolean };
};

export const FIXTURE_POSTS = {
  P01: {
    at: "2026-10-05T03:00:00Z",
    matches: { q1: false },
    labels: { sentiment: "positive", intents: ["praise"], topics: ["ticket"] },
  },
  P02: {
    at: "2026-10-05T04:00:00Z",
    matches: { q1: false, q2: false },
    labels: {
      sentiment: "negative",
      safety: "sensitive",
      intents: ["complaint", "question"],
      topics: ["ticket", "payment"],
    },
  },
  P03: {
    at: "2026-10-06T03:00:00Z",
    matches: { q2: false },
    labels: { language: "en", intents: ["question"], topics: ["venue"] },
  },
  P04: {
    at: "2026-10-06T05:00:00Z",
    matches: { q1: false },
    labels: { sentiment: "negative", safety: "severe", intents: ["complaint"], topics: ["payment"] },
  },
  // Local-midnight boundary: 17:00:00Z = 10-07 00:00 local, 16:59:59Z = 10-06 23:59:59 local.
  P05: { at: "2026-10-06T17:00:00Z", matches: { q1: false }, labels: {} },
  P06: {
    at: "2026-10-06T16:59:59Z",
    matches: { q2: false },
    labels: { sentiment: "positive", language: "en", intents: ["praise"], topics: ["venue"] },
  },
  // `from` is inclusive; AI negative overridden to neutral.
  P07: {
    at: "2026-10-04T17:00:00Z",
    matches: { q1: false },
    labels: { sentiment: "negative", intents: ["complaint"], topics: ["ticket"] },
    override: { field: "sentiment", value: "neutral" },
  },
  // `to` is exclusive → out of range.
  P08: { at: "2026-10-11T17:00:00Z", matches: { q1: false }, labels: { sentiment: "positive" } },
  P09: {
    at: "2026-10-08T03:00:00Z",
    matches: { q1: false },
    labels: { relevance: "irrelevant", sentiment: "positive" },
  },
  P10: {
    at: "2026-10-08T04:00:00Z",
    matches: { q1: false },
    labels: { sentiment: "negative" },
    override: { field: "relevance", value: "irrelevant" },
  },
  // Only match excluded by terms → not in any analytics (A18).
  P11: { at: "2026-10-09T02:00:00Z", matches: { q1: true }, labels: {} },
  // Excluded for q1, valid for q2 → counts for q2 only.
  P12: {
    at: "2026-10-09T03:00:00Z",
    matches: { q1: true, q2: false },
    labels: { sentiment: "negative", intents: ["complaint"], topics: ["ticket"] },
  },
  P13: { at: "2026-10-10T03:00:00Z", matches: { q1: false }, status: "pending" },
  P14: { at: "2026-10-10T04:00:00Z", matches: { q2: false }, status: "failed" },
  P15: { at: "2026-10-10T05:00:00Z", matches: { q1: false }, labels: { relevance: "uncertain" } },
  // "fr" is outside LANGUAGE_CODES → folded into "other" (#201). Revoked override has no effect.
  P16: {
    at: "2026-10-11T03:00:00Z",
    matches: { q1: false },
    labels: { sentiment: "positive", language: "fr", intents: ["praise"], topics: ["artist"] },
    override: { field: "sentiment", value: "negative", revoked: true },
  },
  P17: { at: "2026-09-30T03:00:00Z", matches: { q1: false }, labels: {} },
} satisfies Record<string, PostSpec>;

export type FixturePostKey = keyof typeof FIXTURE_POSTS;

export type AnalyticsFixture = {
  projectId: string;
  otherProjectId: string;
  q1: string;
  q2: string;
  reviewerId: string;
  postIds: Record<FixturePostKey, string>;
};

async function seedAnalysedPost(
  prisma: PrismaService,
  projectId: string,
  queries: Record<"q1" | "q2", string>,
  spec: PostSpec,
  reviewerId: string,
): Promise<string> {
  const now = new Date("2026-10-13T05:00:00Z");
  const post = await createPost(prisma, { projectId, publishedAt: new Date(spec.at), firstSeenAt: new Date(spec.at) });
  for (const [key, excludedByTerms] of Object.entries(spec.matches) as ["q1" | "q2", boolean][]) {
    await prisma.postQueryMatch.create({
      data: {
        postId: post.id,
        queryId: queries[key],
        excludedByTerms,
        firstMatchedAt: post.publishedAt,
        lastMatchedAt: now,
      },
    });
  }
  if (spec.status) {
    await prisma.socialPost.update({ where: { id: post.id }, data: { latestRunStatus: spec.status } });
    return post.id;
  }
  const l: Labels = { relevance: "relevant", sentiment: "neutral", safety: "safe", language: "vi", ...spec.labels };
  const runId = randomUUID();
  const analysisId = randomUUID();
  await prisma.analysisRun.create({
    data: {
      id: runId,
      postId: post.id,
      projectId,
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
      projectId,
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
  if (spec.override) {
    await prisma.analysisOverride.create({
      data: {
        id: randomUUID(),
        postId: post.id,
        projectId,
        field: spec.override.field,
        overrideValue: { value: spec.override.value },
        reviewedBy: reviewerId,
        revokedAt: spec.override.revoked ? now : null,
      },
    });
  }
  return post.id;
}

/** Seeds the T-094 dataset plus X01 in a second project (scoping). Caller resets the DB first. */
export async function seedAnalyticsFixture(prisma: PrismaService): Promise<AnalyticsFixture> {
  const projectId = (await createProject(prisma, { timezone: FIXTURE_TZ })).id;
  const otherProjectId = (await createProject(prisma, { timezone: FIXTURE_TZ })).id;
  const q1 = (await createQuery(prisma, { projectId, displayName: "1zone", queryValue: "1zone" })).id;
  const q2 = (await createQuery(prisma, { projectId, displayName: "eventista", queryValue: "eventista" })).id;
  const xq = (await createQuery(prisma, { projectId: otherProjectId })).id;
  const reviewerId = (await createUser(prisma)).id;

  const postIds = {} as Record<FixturePostKey, string>;
  for (const [key, spec] of Object.entries(FIXTURE_POSTS) as [FixturePostKey, PostSpec][]) {
    postIds[key] = await seedAnalysedPost(prisma, projectId, { q1, q2 }, spec, reviewerId);
  }
  // X01: other project, would change every number if scoping leaked.
  await seedAnalysedPost(
    prisma,
    otherProjectId,
    { q1: xq, q2: xq },
    {
      at: "2026-10-06T03:00:00Z",
      matches: { q1: false },
      labels: { sentiment: "negative", safety: "severe", intents: ["complaint"], topics: ["ticket"] },
    },
    reviewerId,
  );
  return { projectId, otherProjectId, q1, q2, reviewerId, postIds };
}

// --- Drill-down helpers: mirror apps/web/src/lib/filters/drill-down.ts (T-102, doc 07 §6) ---------------------

export type DrillParams = Record<string, string>;

export function kpiDrill(
  id: "mentions" | "growth" | "positive" | "negative" | "safety" | "complaint" | "severe",
): DrillParams {
  switch (id) {
    case "mentions":
    case "growth":
      return {};
    case "positive":
      return { sentiment: "positive" };
    case "negative":
      return { sentiment: "negative" };
    case "safety":
      return { safety: "sensitive,severe" };
    case "severe":
      return { safety: "severe" };
    case "complaint":
      return { intent: "complaint" };
  }
}

/** Topic "other" (top-12 rest) has no filter → null. */
export function segmentDrill(
  dim: "sentiment" | "safety" | "topic" | "intent" | "language",
  value: string,
): DrillParams | null {
  if (dim === "topic" && value === "other") return null;
  return { [dim]: value };
}

export function queryDrill(queryId: string): DrillParams {
  return { queryIds: queryId };
}

/** Bucket i → [start_i, start_{i+1}), last bucket ends at range.to, clamped to the range. */
export function bucketDrill(
  times: readonly string[],
  index: number,
  range: { from: string; to: string },
): DrillParams | null {
  const start = times[index];
  if (start === undefined) return null;
  const next = times[index + 1];
  const from = Math.max(Date.parse(start), Date.parse(range.from));
  const to = Math.min(next === undefined ? Date.parse(range.to) : Date.parse(next), Date.parse(range.to));
  if (!(from < to)) return null;
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
}
