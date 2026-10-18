/**
 * `buildDemoDataset` — the whole demo dataset (#294) as plain rows. Pure: no DB, no `Math.random`, no `Date.now()`.
 * Same seed → same ids (re-runs replace rows in place); the anchor only shifts timestamps.
 */
import { createRng, type Rng } from "../perf-seed/prng";
import { buildAnalysisSettings, buildAuditLogs, buildDemoQueries, buildSyncJobs, HOUR } from "./ops";
import { buildPosts, markReviewed, reviewReasons, type PostsResult } from "./posts";
import { DEMO_LANDING_TERMS } from "./text-bank";
import type { DemoAnalysis, DemoDataset, DemoInput, DemoOverride, OverrideFieldName } from "./types";

export const DEMO_PHRASE_MIN_MENTIONS = 3;
const OVERRIDE_POSTS = 15;

function flip(field: OverrideFieldName, a: DemoAnalysis): { prev: string | string[]; next: string | string[] } {
  switch (field) {
    case "relevance":
      return { prev: a.relevanceLabel, next: a.relevanceLabel === "relevant" ? "irrelevant" : "relevant" };
    case "sentiment":
      return { prev: a.sentimentLabel, next: a.sentimentLabel === "negative" ? "neutral" : "negative" };
    case "safety_level":
      return { prev: a.safetyLevel, next: a.safetyLevel === "safe" ? "sensitive" : "safe" };
    case "intents":
      return { prev: a.intents.map((x) => x.label), next: ["complaint"] };
    case "topics":
      return { prev: a.topics.map((x) => x.label), next: ["customer_service"] };
  }
}

/** BR-025: ≤ 1 active override per (post, field); a third of them also carry a revoked earlier override (history). */
function buildOverrides(rng: Rng, ids: Rng, input: DemoInput, r: PostsResult): DemoOverride[] {
  const runsById = new Map(r.runs.map((x) => [x.id, x]));
  const analysisById = new Map(r.analyses.map((a) => [a.id, a]));
  // Only posts outside the review queue, so overrides never change the generated review reasons.
  const candidates = r.posts.filter((p) => {
    const a = p.currentAnalysisId ? analysisById.get(p.currentAnalysisId) : undefined;
    return a !== undefined && reviewReasons(p, runsById, a).length === 0;
  });
  const fields: readonly OverrideFieldName[] = ["relevance", "sentiment", "safety_level", "intents", "topics"];
  const out: DemoOverride[] = [];
  const anchorMs = input.anchor.getTime();
  rng.sample(candidates, OVERRIDE_POSTS).forEach((post, i) => {
    const a = post.currentAnalysisId ? analysisById.get(post.currentAnalysisId) : undefined;
    if (!a) return;
    const field = fields[i % fields.length] ?? "sentiment";
    const { prev, next } = flip(field, a);
    const reviewer = rng.pick([input.users.analyst, input.users.admin]);
    const t0 = a.createdAt.getTime();
    const activeAt = Math.min(t0 + rng.int(2, 30) * HOUR, anchorMs - 2 * 60_000);
    if (i % 3 === 0) {
      out.push({
        id: ids.uuid(),
        postId: post.id,
        analysisId: a.id,
        field,
        previousValue: { value: prev },
        overrideValue: { value: prev === next ? prev : next },
        reason: "Gán nhầm, đã thu hồi (demo)",
        reviewedBy: reviewer,
        createdAt: new Date((t0 + activeAt) / 2),
        revokedAt: new Date((t0 + activeAt) / 2 + 60_000),
        revokedBy: input.users.admin,
      });
    }
    out.push({
      id: ids.uuid(),
      postId: post.id,
      analysisId: a.id,
      field,
      previousValue: { value: prev },
      overrideValue: { value: next },
      reason: "Sửa nhãn sau khi đọc lại bài (demo)",
      reviewedBy: reviewer,
      createdAt: new Date(activeAt),
      revokedAt: null,
      revokedBy: null,
    });
  });
  return out;
}

export function buildDemoDataset(input: DemoInput): DemoDataset {
  // Separate streams: ids never shift when a distribution tweak changes how many data draws are made.
  const ids = createRng(input.seed * 7919 + 1);
  const rng = createRng(input.seed);
  const analysisSettings = buildAnalysisSettings(ids, input);
  const queries = buildDemoQueries(ids, input);
  const allQueries = [...input.baseQueries.map((q) => ({ ...q, excludeTerms: [] as string[] })), ...queries];
  const postsResult = buildPosts(rng, ids, input, allQueries);
  markReviewed(rng, input, postsResult);
  const overrides = buildOverrides(rng, ids, input, postsResult);
  const jobQueries = [
    ...input.baseQueries.map((q) => ({
      id: q.id,
      searchMode: q.queryType === "keyword" ? ("KEYWORD" as const) : ("TAG" as const),
      deletedAt: null,
    })),
    ...queries,
  ];
  const syncJobs = buildSyncJobs(rng, ids, input, jobQueries);
  const settingsV2 = analysisSettings[1];
  if (!settingsV2) throw new Error("demo seed: missing analysis settings v2");
  const auditLogs = buildAuditLogs(rng, ids, input, {
    queryIds: queries.map((q) => q.id),
    overrideIds: overrides.map((o) => o.id),
    postIds: postsResult.posts.slice(0, 50).map((p) => p.id),
    settingsId: settingsV2.id,
  });
  return {
    analysisSettings,
    queries,
    ...postsResult,
    overrides,
    syncJobs,
    auditLogs,
    collectorState: { consecutiveProviderFailures: 1 },
    projectSettings: { phraseMinMentions: DEMO_PHRASE_MIN_MENTIONS, landingTerms: [...DEMO_LANDING_TERMS] },
  };
}
