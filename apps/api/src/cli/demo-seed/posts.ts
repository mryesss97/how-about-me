/**
 * Demo seed (#294): posts, query matches, analysis runs / results (append-only, versioned) and review state.
 * Pure and deterministic: randomness only from the seeded `Rng`, time only from `anchor`.
 */
import { createHash } from "node:crypto";
import { normalizePhrase, MAX_PHRASES_PER_POST, TAXONOMY_VERSION, safetyPolicyVersionOf } from "@how-about-me/taxonomy";
import type { Rng } from "../perf-seed/prng";
import { BRAND_MENTIONS, OPENERS, TOPIC_BANK, USERNAMES, type DemoLang, type TopicEntry } from "./text-bank";
import { DAY, HOUR, MIN, V2_BANDS, V2_OFFSET } from "./ops";
import type {
  BaseQuery,
  DemoAnalysis,
  DemoInput,
  DemoMatch,
  DemoPost,
  DemoQuery,
  DemoRun,
  Relevance,
  RunStatus,
  RunTrigger,
  Safety,
  Sentiment,
} from "./types";

export const POST_COUNT = 600;
export const DEMO_POST_PREFIX = "demo_";
const VN_OFFSET = 7 * HOUR; // Asia/Ho_Chi_Minh has no DST
const V1 = safetyPolicyVersionOf(1);
const V2 = safetyPolicyVersionOf(2);
const BANDS: Record<string, { high: number; medium: number }> = { [V1]: { high: 0.8, medium: 0.6 }, [V2]: V2_BANDS };

/** Fake providers (PROVIDERS_MODE=fake) — same field order as `computeEffectiveVersion` (doc 07 §7, BR-023). */
export function demoEffectiveVersion(policyVersion: string): string {
  return ["fake", "fake-classifier-v1", "fake-v2", TAXONOMY_VERSION, "fake", "fake-moderation-v1", policyVersion].join(
    "|",
  );
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Hour-of-day weights in Vietnam time: quiet 1–6h, peak 19–23h. */
const HOUR_WEIGHTS: readonly (readonly [number, number])[] = Array.from({ length: 24 }, (_, h) => [
  h,
  h >= 1 && h <= 6 ? 0.3 : h >= 19 && h <= 23 ? 3 : h >= 11 && h <= 13 ? 1.6 : 1,
]);
/** Event days (days before anchor) get a burst. */
const EVENT_DAYS = new Set([3, 4, 12, 20]);

type Scenario =
  "normal" | "revision" | "history_version" | "history_manual" | "failed" | "pending" | "processing" | "skipped";

type QueryLike =
  Pick<DemoQuery, "id" | "queryType" | "queryValue" | "excludeTerms"> | (BaseQuery & { excludeTerms?: string[] });

export type PostsResult = { posts: DemoPost[]; matches: DemoMatch[]; runs: DemoRun[]; analyses: DemoAnalysis[] };

function publishedAt(rng: Rng, anchor: Date): Date {
  const vnMidnight = Math.floor((anchor.getTime() + VN_OFFSET) / DAY) * DAY - VN_OFFSET;
  const day = rng.weighted(
    Array.from({ length: 29 }, (_, d) => {
      const dow = new Date(vnMidnight - d * DAY + VN_OFFSET).getUTCDay();
      return [d, (EVENT_DAYS.has(d) ? 3 : 1) * (dow === 0 || dow === 6 ? 1.5 : 1) * (d < 7 ? 1.3 : 1)] as const;
    }),
  );
  const hour = rng.weighted(HOUR_WEIGHTS);
  let t = vnMidnight - day * DAY + hour * HOUR + rng.int(0, 59) * MIN;
  // Keep ≥ 2 h before the anchor so every follow-up run / review stays in the past.
  if (t > anchor.getTime() - 2 * HOUR) t -= DAY;
  return new Date(t);
}

function sentence(rng: Rng, e: TopicEntry, lang: DemoLang, s: Sentiment) {
  return rng.pick(e.text[lang][s]);
}

function matchesQuery(text: string, q: QueryLike): boolean {
  const t = text.toLocaleLowerCase("vi");
  const v = q.queryValue.toLocaleLowerCase("vi");
  return q.queryType === "topic_tag" ? t.includes(`#${v}`) : t.includes(v);
}

const INTENTS_BY_SENTIMENT: Record<Sentiment, readonly string[]> = {
  positive: ["praise", "recommendation", "purchase_intent"],
  neutral: ["question", "information", "comparison"],
  negative: ["complaint", "support_request", "boycott"],
};

function confidences(rng: Rng, policy: string) {
  const b = BANDS[policy] ?? V2_BANDS;
  const band = rng.weighted([
    ["high", 60],
    ["medium", 30],
    ["low", 10],
  ] as const);
  const r4 = (x: number) => Math.round(x * 10_000) / 10_000;
  const overall = r4(
    band === "high"
      ? b.high + 0.01 + rng.next() * (0.98 - b.high)
      : band === "medium"
        ? b.medium + 0.01 + rng.next() * (b.high - b.medium - 0.02)
        : 0.35 + rng.next() * (b.medium - 0.4),
  );
  const other = r4(Math.min(0.99, overall + rng.next() * 0.1));
  // doc 08 §8: overall = min(relevance, sentiment).
  return rng.chance(0.5) ? { rel: overall, sent: other, overall } : { rel: other, sent: overall, overall };
}

type PostFacts = { lang: DemoLang; text: string; topics: TopicEntry[]; sentiment: Sentiment; relevance: Relevance };

function buildAnalysis(rng: Rng, ids: Rng, run: DemoRun, f: PostFacts): DemoAnalysis {
  const c = confidences(rng, run.policyVersion);
  const safety: Safety = rng.weighted([
    ["safe", 93],
    ["sensitive", 6],
    ["severe", 1],
  ] as const);
  const lower = f.text.toLocaleLowerCase("vi");
  const phrases: string[] = [];
  for (const raw of f.topics.flatMap((t) => t.phrases)) {
    const p = normalizePhrase(raw); // BR-041
    if (p && lower.includes(p) && !phrases.includes(p)) phrases.push(p);
    if (phrases.length === MAX_PHRASES_PER_POST) break;
  }
  const intents = rng.sample(INTENTS_BY_SENTIMENT[f.sentiment], rng.int(1, 2));
  const score = safety === "safe" ? rng.next() * 0.2 : safety === "sensitive" ? 0.5 + rng.next() * 0.3 : 0.9;
  return {
    id: ids.uuid(),
    analysisRunId: run.id,
    postId: run.postId,
    relevanceLabel: f.relevance,
    relevanceConfidence: c.rel,
    relevanceExplanation:
      f.relevance === "irrelevant" ? "Không liên quan tới sự kiện (demo)" : "Nhắc tới 1Zone/Eventista (demo)",
    sentimentLabel: f.sentiment,
    sentimentConfidence: c.sent,
    safetyLevel: safety,
    safetyFlagged: safety !== "safe",
    safetyCategoryScores: { harassment: Math.round(score * 10_000) / 10_000 },
    languageCode: f.lang,
    summary: f.text.slice(0, 100),
    overallModelConfidence: c.overall,
    createdAt: run.completedAt ?? run.createdAt,
    intents: intents.map((label) => ({ label, confidence: Math.round((0.6 + rng.next() * 0.39) * 10_000) / 10_000 })),
    topics: f.topics.map((t, i) => ({ label: t.topic, confidence: i === 0 ? 0.9 : 0.7 })),
    phrases,
  };
}

function newRun(
  ids: Rng,
  rng: Rng,
  p: { postId: string; hash: string; revision: number; policy: string; createdAt: Date },
  status: RunStatus,
  trigger: RunTrigger,
  requestedBy: string | null = null,
): DemoRun {
  const finished = status !== "pending" && status !== "processing";
  const startedAt = status === "pending" ? null : new Date(p.createdAt.getTime() + rng.int(1, 30) * 1000);
  const ok = status === "completed" || status === "stale";
  const failedCode = status === "failed" ? rng.pick(["ANALYSIS_PROVIDER_ERROR", "ANALYSIS_SCHEMA_INVALID"]) : null;
  return {
    id: ids.uuid(),
    postId: p.postId,
    status,
    trigger,
    sourceContentHash: p.hash,
    sourceRevision: p.revision,
    effectiveVersion: demoEffectiveVersion(p.policy),
    policyVersion: p.policy,
    startedAt,
    completedAt: finished && startedAt ? new Date(startedAt.getTime() + rng.int(2, 20) * 1000) : null,
    inputTokens: ok ? rng.int(300, 900) : null,
    outputTokens: ok ? rng.int(80, 240) : null,
    attemptCount: status === "pending" ? 0 : status === "failed" ? 3 : 1,
    skippedReason: status === "skipped" ? "irrelevant" : null,
    errorCode: failedCode,
    errorMessage: failedCode ? `${failedCode} (demo)` : null,
    lockedAt: status === "processing" ? startedAt : null,
    lockedBy: status === "processing" ? "demo-seed" : null,
    requestedBy,
    createdAt: p.createdAt,
  };
}

export function buildPosts(rng: Rng, ids: Rng, input: DemoInput, queries: readonly QueryLike[]): PostsResult {
  const { anchor, users } = input;
  const out: PostsResult = { posts: [], matches: [], runs: [], analyses: [] };
  const v2At = anchor.getTime() - V2_OFFSET;
  const latest = (ms: number) => new Date(Math.min(ms, anchor.getTime() - MIN));

  for (let i = 0; i < POST_COUNT; i++) {
    const postId = ids.uuid();
    const lang: DemoLang = rng.chance(0.85) ? "vi" : "en";
    const pub = publishedAt(rng, anchor);
    const primary = rng.pick(TOPIC_BANK);
    const topics = rng.chance(0.25) ? [primary, rng.pick(TOPIC_BANK.filter((t) => t !== primary))] : [primary];
    const sentiment: Sentiment = rng.weighted([
      ["positive", 45],
      ["neutral", 35],
      ["negative", 20],
    ] as const);
    const relevance: Relevance = rng.weighted([
      ["relevant", 75],
      ["uncertain", 12],
      ["irrelevant", 13],
    ] as const);
    const parts = [
      rng.pick(OPENERS[lang]),
      rng.weighted(BRAND_MENTIONS[lang]),
      ...topics.map((t) => sentence(rng, t, lang, sentiment)),
    ];
    if (lang === "vi" && rng.chance(0.03)) parts.push("ai cần pass vé ib nha");
    const text = parts.filter(Boolean).join(" ");
    const revision = rng.chance(0.05) ? rng.int(2, 3) : 1;
    const hash = sha(text);
    const firstSeenAt = new Date(pub.getTime() + rng.int(2, 30) * MIN);
    const facts: PostFacts = { lang, text, topics, sentiment, relevance };

    let scenario: Scenario =
      revision > 1
        ? "revision"
        : rng.weighted([
            ["normal", 82],
            ["history_version", 2],
            ["history_manual", 1],
            ["failed", 4],
            ["pending", 2],
            ["processing", 1],
            ["skipped", 1],
          ] as const);
    if (scenario === "history_version" && pub.getTime() > v2At - DAY) scenario = "history_manual";
    if (scenario === "skipped" && relevance !== "irrelevant") scenario = "normal";

    const base = {
      postId,
      hash,
      revision,
      policy: V2,
      createdAt: new Date(firstSeenAt.getTime() + rng.int(5, 120) * 1000),
    };
    const runs: DemoRun[] = [];
    const withResult = new Set<string>();
    const add = (r: DemoRun, result: boolean) => {
      runs.push(r);
      if (result) withResult.add(r.id);
    };
    switch (scenario) {
      case "normal":
        add(newRun(ids, rng, base, "completed", "ingest"), true);
        break;
      case "revision": {
        // FR-078: the older content hash's completed run went stale; a content_change run analysed the new text.
        const oldHash = sha(`${text}#rev${revision - 1}`);
        add(newRun(ids, rng, { ...base, hash: oldHash, revision: revision - 1 }, "stale", "ingest"), true);
        const r2 = { ...base, createdAt: latest(base.createdAt.getTime() + rng.int(1, 20) * HOUR) };
        add(newRun(ids, rng, r2, rng.chance(0.85) ? "completed" : "pending", "content_change"), false);
        break;
      }
      case "history_version": {
        // BR-023: v1 result staled by the policy change, re-run under v2.
        add(newRun(ids, rng, { ...base, policy: V1 }, "stale", "ingest"), true);
        add(
          newRun(
            ids,
            rng,
            { ...base, createdAt: new Date(v2At + rng.int(1, 48) * HOUR) },
            "completed",
            "version_change",
          ),
          true,
        );
        break;
      }
      case "history_manual": {
        add(newRun(ids, rng, base, "completed", "ingest"), true);
        const r2 = { ...base, createdAt: latest(base.createdAt.getTime() + rng.int(1, 30) * HOUR) };
        add(newRun(ids, rng, r2, "completed", "manual", rng.pick([users.admin, users.analyst])), true);
        break;
      }
      case "failed":
        if (rng.chance(0.5)) {
          add(newRun(ids, rng, base, "failed", "ingest"), false);
        } else {
          add(newRun(ids, rng, base, "completed", "ingest"), true);
          const r2 = { ...base, createdAt: latest(base.createdAt.getTime() + rng.int(1, 10) * HOUR) };
          add(newRun(ids, rng, r2, "failed", "manual", users.analyst), false);
        }
        break;
      case "pending":
      case "processing":
      case "skipped":
        add(newRun(ids, rng, base, scenario, "ingest"), false);
        break;
    }
    // Revision run 2 carries a result when completed.
    const last = runs[runs.length - 1];
    if (!last) throw new Error("demo seed: post without run");
    if (last.status === "completed") withResult.add(last.id);

    const analyses = runs.filter((r) => withResult.has(r.id)).map((r) => buildAnalysis(rng, ids, r, facts));
    const current = [...runs].reverse().find((r) => r.status === "completed");
    const currentAnalysis = current ? analyses.find((a) => a.analysisRunId === current.id) : undefined;

    const username = rng.pick(USERNAMES);
    const shortcode = `DEMO${String(i).padStart(4, "0")}`;
    out.posts.push({
      id: postId,
      platformPostId: `${DEMO_POST_PREFIX}${String(i).padStart(4, "0")}`,
      username,
      ownerId: `demo_owner_${USERNAMES.indexOf(username)}`,
      text,
      permalink: `https://www.threads.net/@${username}/post/${shortcode}`,
      shortcode,
      lang,
      publishedAt: pub,
      contentHash: hash,
      revision,
      firstSeenAt,
      lastSeenAt: last.createdAt,
      latestRunStatus: last.status,
      currentAnalysisId: currentAnalysis?.id ?? null,
      reviewedAt: null,
      reviewedBy: null,
    });
    for (const q of queries) {
      if (!matchesQuery(text, q)) continue;
      const excluded = (q.excludeTerms ?? []).some((t) => text.toLocaleLowerCase("vi").includes(t));
      out.matches.push({
        postId,
        queryId: q.id,
        firstMatchedAt: firstSeenAt,
        lastMatchedAt: last.createdAt,
        excludedByTerms: excluded,
      });
    }
    out.runs.push(...runs);
    out.analyses.push(...analyses);
  }
  return out;
}

/**
 * FR-195 review reasons of a post: latest run failed, effective relevance uncertain, or overall confidence below the
 * medium band of the policy the run was analysed with (BR-021). Ignores overrides (the loader adds none to these).
 */
export function reviewReasons(post: DemoPost, runsById: Map<string, DemoRun>, analysis: DemoAnalysis | undefined) {
  const reasons: ("failed" | "uncertain" | "low_confidence")[] = [];
  if (post.latestRunStatus === "failed") reasons.push("failed");
  if (analysis?.relevanceLabel === "uncertain") reasons.push("uncertain");
  const run = analysis ? runsById.get(analysis.analysisRunId) : undefined;
  const medium = run ? (BANDS[run.policyVersion] ?? V2_BANDS).medium : 0;
  if (analysis && analysis.overallModelConfidence < medium) reasons.push("low_confidence");
  return reasons;
}

/** BR-040: ~30% of queued posts get reviewed_at after their latest run, so the "reviewed" tab is not empty. */
export function markReviewed(rng: Rng, input: DemoInput, r: PostsResult): void {
  const runsById = new Map(r.runs.map((x) => [x.id, x]));
  const analysisById = new Map(r.analyses.map((a) => [a.id, a]));
  const latestRun = new Map<string, DemoRun>();
  for (const run of r.runs) latestRun.set(run.postId, run); // runs are pushed in creation order per post
  for (const post of r.posts) {
    const a = post.currentAnalysisId ? analysisById.get(post.currentAnalysisId) : undefined;
    if (reviewReasons(post, runsById, a).length === 0 || !rng.chance(0.3)) continue;
    const lastAt = latestRun.get(post.id)?.createdAt.getTime() ?? post.firstSeenAt.getTime();
    post.reviewedAt = new Date(Math.min(lastAt + rng.int(1, 36) * HOUR, input.anchor.getTime() - 30_000));
    post.reviewedBy = rng.pick([input.users.analyst, input.users.admin]);
  }
}
