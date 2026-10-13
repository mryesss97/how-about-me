/**
 * Synthetic perf dataset (T-097, #84) — pure row generation, no I/O. Distribution is documented in
 * docs/02-architecture/12-performance-report.md §2. Never derived from real user data: text comes from a fixed
 * vocabulary, usernames are `perf_user_<n>`, ids come from the seeded PRNG.
 */
import { INTENT_LABELS, TOPIC_LABELS } from "@how-about-me/taxonomy";
import type { Rng } from "./prng";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export type SeedConfig = { posts: number; days: number; anchor: Date; auditLogs: number; syncJobs: number };

export type UserRow = { id: string; email: string };
export type ProjectRow = { id: string; slug: string; name: string; share: number };
export type QueryRow = { id: string; projectId: string; name: string; value: string; deleted: boolean };
export type Fixture = { users: UserRow[]; projects: ProjectRow[]; queries: QueryRow[] };

export type RunStatus = "pending" | "completed" | "failed";
export type PostRow = {
  id: string;
  projectId: string;
  platformPostId: string;
  username: string;
  text: string;
  publishedAt: Date;
  firstSeenAt: Date;
  contentHash: string;
  currentAnalysisId: string | null;
  latestRunStatus: RunStatus | null;
};
export type MatchRow = { postId: string; queryId: string; matchedAt: Date; excluded: boolean };
export type RunRow = {
  id: string;
  postId: string;
  projectId: string;
  status: RunStatus;
  contentHash: string;
  createdAt: Date;
  completedAt: Date | null;
  errorCode: string | null;
};
export type AnalysisRow = {
  id: string;
  runId: string;
  postId: string;
  projectId: string;
  relevance: "relevant" | "uncertain" | "irrelevant";
  relevanceConfidence: number;
  sentiment: "positive" | "neutral" | "negative" | null;
  sentimentConfidence: number | null;
  safety: "safe" | "sensitive" | "severe";
  language: string;
  overall: number;
  createdAt: Date;
};
export type LabelRow = { analysisId: string; label: string; confidence: number };
export type OverrideField = "relevance" | "sentiment" | "safety_level" | "intents" | "topics";
export type OverrideRow = {
  id: string;
  postId: string;
  projectId: string;
  analysisId: string;
  field: OverrideField;
  value: string | string[];
  reviewedBy: string;
  createdAt: Date;
  revokedAt: Date | null;
};
export type ChunkRows = {
  posts: PostRow[];
  matches: MatchRow[];
  runs: RunRow[];
  analyses: AnalysisRow[];
  intents: LabelRow[];
  topics: LabelRow[];
  overrides: OverrideRow[];
};
export type AuditRow = { id: string; projectId: string; actorUserId: string; action: string; createdAt: Date };
export type SyncJobRow = { id: string; projectId: string; queryId: string; createdAt: Date };

/** Tunable shares — the unit test asserts generated data stays within tolerance of these. */
export const DIST = {
  /** Extra mass in the last 7 days on top of the uniform spread (~8k posts / 7d at 100k). */
  recentBurst: 0.03,
  status: [
    ["completed", 0.92],
    ["pending", 0.04],
    ["failed", 0.02],
    [null, 0.02],
  ] as const,
  /** Completed posts with an older superseded analysis (→ ~120k analyses at 100k posts). */
  reanalysed: 0.28,
  priorAnalysisOnPendingOrFailed: 0.4,
  relevance: [
    ["relevant", 0.7],
    ["irrelevant", 0.2],
    ["uncertain", 0.1],
  ] as const,
  sentiment: [
    ["positive", 0.35],
    ["neutral", 0.4],
    ["negative", 0.25],
  ] as const,
  safety: [
    ["safe", 0.9],
    ["sensitive", 0.08],
    ["severe", 0.02],
  ] as const,
  language: [
    ["vi", 0.6],
    ["en", 0.25],
    ["ko", 0.02],
    ["ja", 0.02],
    ["th", 0.02],
    ["zh", 0.02],
    ["other", 0.03],
    ["unknown", 0.02],
  ] as const,
  secondMatch: 0.3,
  excludedMatch: 0.05,
  override: 0.01,
  revokedOverride: 0.1,
} as const;

const VOCAB = [
  "aurora",
  "concert",
  "vé",
  "ticket",
  "giá",
  "price",
  "show",
  "fan",
  "sân khấu",
  "venue",
  "hàng chờ",
  "queue",
  "hoàn tiền",
  "refund",
  "thanh toán",
  "payment",
  "nghệ sĩ",
  "artist",
  "merch",
  "áo",
  "đẹp",
  "tệ",
  "great",
  "bad",
  "hỏi",
  "question",
  "khi nào",
  "mở bán",
  "membership",
  "hội viên",
  "hủy",
  "cancel",
  "tuyệt vời",
  "amazing",
  "chán",
  "boring",
  "đông",
  "crowded",
  "nhanh",
  "slow",
  "support",
  "hỗ trợ",
  "sự kiện",
  "event",
  "mua",
  "buy",
] as const;

const PROJECTS: readonly Omit<ProjectRow, "id">[] = [
  { slug: "perf-large", name: "Perf large", share: 0.9 },
  { slug: "perf-small", name: "Perf small", share: 0.1 },
];
const QUERIES_PER_PROJECT = 6;

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export function buildFixture(rng: Rng): Fixture {
  const users = [0, 1, 2].map((i) => ({ id: rng.uuid(), email: `perf-user-${i}@example.test` }));
  const projects = PROJECTS.map((p) => ({ ...p, id: rng.uuid() }));
  const queries = projects.flatMap((p) =>
    Array.from({ length: QUERIES_PER_PROJECT }, (_, i) => ({
      id: rng.uuid(),
      projectId: p.id,
      name: `${p.slug} query ${i}`,
      value: `${VOCAB[i] ?? "aurora"} ${p.slug}`,
      // BR-010: one soft-deleted query per project still counts for history.
      deleted: i === QUERIES_PER_PROJECT - 1,
    })),
  );
  return { users, projects, queries };
}

function publishedAt(rng: Rng, cfg: SeedConfig): Date {
  const span = rng.chance(DIST.recentBurst) ? 7 * DAY_MS : cfg.days * DAY_MS;
  return new Date(cfg.anchor.getTime() - Math.floor(rng.next() * span));
}

function text(rng: Rng): string {
  return Array.from({ length: rng.int(8, 30) }, () => rng.pick(VOCAB)).join(" ");
}

function analysisFor(rng: Rng, post: PostRow, runId: string, createdAt: Date): AnalysisRow {
  const relevance = rng.weighted(DIST.relevance);
  const relevanceConfidence = round4(0.5 + rng.next() * 0.49);
  const sentiment = relevance === "irrelevant" ? null : rng.weighted(DIST.sentiment);
  const sentimentConfidence = sentiment ? round4(0.5 + rng.next() * 0.49) : null;
  return {
    id: rng.uuid(),
    runId,
    postId: post.id,
    projectId: post.projectId,
    relevance,
    relevanceConfidence,
    sentiment,
    sentimentConfidence,
    safety: rng.weighted(DIST.safety),
    language: rng.weighted(DIST.language),
    overall: Math.min(relevanceConfidence, sentimentConfidence ?? relevanceConfidence),
    createdAt,
  };
}

function overrideValue(rng: Rng, field: OverrideField): string | string[] {
  switch (field) {
    case "relevance":
      return rng.pick(["relevant", "uncertain", "irrelevant"]);
    case "sentiment":
      return rng.pick(["positive", "neutral", "negative"]);
    case "safety_level":
      return rng.pick(["safe", "sensitive", "severe"]);
    case "intents":
      return rng.sample(INTENT_LABELS, rng.int(1, 2));
    case "topics":
      return rng.sample(TOPIC_LABELS, rng.int(1, 2));
  }
}

/** Rows for posts [start, start+count). Call sequentially with one Rng for a deterministic dataset. */
export function generateChunk(rng: Rng, fx: Fixture, cfg: SeedConfig, start: number, count: number): ChunkRows {
  const out: ChunkRows = { posts: [], matches: [], runs: [], analyses: [], intents: [], topics: [], overrides: [] };
  for (let n = start; n < start + count; n++) {
    const project = rng.weighted(fx.projects.map((p) => [p, p.share] as const));
    const pub = publishedAt(rng, cfg);
    const firstSeen = new Date(Math.min(cfg.anchor.getTime(), pub.getTime() + rng.int(0, 2 * HOUR_MS)));
    const status = rng.weighted(DIST.status);
    const post: PostRow = {
      id: rng.uuid(),
      projectId: project.id,
      platformPostId: `perf-${n}`,
      username: `perf_user_${rng.int(1, 5000)}`,
      text: text(rng),
      publishedAt: pub,
      firstSeenAt: firstSeen,
      contentHash: `perf-hash-${n}`,
      currentAnalysisId: null,
      latestRunStatus: status,
    };
    out.posts.push(post);

    const queries = fx.queries.filter((q) => q.projectId === project.id);
    for (const q of rng.sample(queries, rng.chance(DIST.secondMatch) ? 2 : 1)) {
      out.matches.push({
        postId: post.id,
        queryId: q.id,
        matchedAt: firstSeen,
        excluded: rng.chance(DIST.excludedMatch),
      });
    }

    const completedRuns =
      status === "completed"
        ? 1 + (rng.chance(DIST.reanalysed) ? 1 : 0)
        : status !== null && rng.chance(DIST.priorAnalysisOnPendingOrFailed)
          ? 1
          : 0;
    let t = firstSeen.getTime();
    for (let i = 0; i < completedRuns; i++) {
      t += rng.int(1, 6 * HOUR_MS);
      const at = new Date(t);
      const run: RunRow = {
        id: rng.uuid(),
        postId: post.id,
        projectId: project.id,
        status: "completed",
        contentHash: post.contentHash,
        createdAt: at,
        completedAt: at,
        errorCode: null,
      };
      const a = analysisFor(rng, post, run.id, at);
      out.runs.push(run);
      out.analyses.push(a);
      if (a.relevance !== "irrelevant") {
        for (const l of rng.sample(INTENT_LABELS, rng.int(0, 3)))
          out.intents.push({ analysisId: a.id, label: l, confidence: round4(0.5 + rng.next() * 0.49) });
        for (const l of rng.sample(TOPIC_LABELS, rng.int(0, 2)))
          out.topics.push({ analysisId: a.id, label: l, confidence: round4(0.5 + rng.next() * 0.49) });
      }
      post.currentAnalysisId = a.id;
    }
    if (status === "pending" || status === "failed") {
      t += rng.int(1, 6 * HOUR_MS);
      out.runs.push({
        id: rng.uuid(),
        postId: post.id,
        projectId: project.id,
        status,
        contentHash: post.contentHash,
        createdAt: new Date(t),
        completedAt: status === "failed" ? new Date(t) : null,
        errorCode: status === "failed" ? "CLASSIFIER_TIMEOUT" : null,
      });
    }

    if (post.currentAnalysisId && rng.chance(DIST.override)) {
      const field = rng.pick<OverrideField>(["relevance", "sentiment", "safety_level", "intents", "topics"]);
      const createdAt = new Date(t + rng.int(1, DAY_MS));
      out.overrides.push({
        id: rng.uuid(),
        postId: post.id,
        projectId: project.id,
        analysisId: post.currentAnalysisId,
        field,
        value: overrideValue(rng, field),
        reviewedBy: rng.pick(fx.users).id,
        createdAt,
        revokedAt: rng.chance(DIST.revokedOverride) ? new Date(createdAt.getTime() + HOUR_MS) : null,
      });
    }
  }
  return out;
}

/** Audit trail incl. `mentions.exported` rows so the export throttle query (FR-181) has realistic volume. */
export function generateAuditLogs(rng: Rng, fx: Fixture, cfg: SeedConfig): AuditRow[] {
  const actions = [
    ["mentions.exported", 0.3],
    ["analysis.override.created", 0.2],
    ["mentions.reanalyze", 0.2],
    ["listening_query.updated", 0.2],
    ["member.invited", 0.1],
  ] as const;
  return Array.from({ length: cfg.auditLogs }, () => ({
    id: rng.uuid(),
    projectId: rng.pick(fx.projects).id,
    actorUserId: rng.pick(fx.users).id,
    action: rng.weighted(actions),
    createdAt: new Date(cfg.anchor.getTime() - Math.floor(rng.next() * cfg.days * DAY_MS)),
  }));
}

export function generateSyncJobs(rng: Rng, fx: Fixture, cfg: SeedConfig): SyncJobRow[] {
  const active = fx.queries.filter((q) => !q.deleted);
  return Array.from({ length: cfg.syncJobs }, () => {
    const q = rng.pick(active);
    return {
      id: rng.uuid(),
      projectId: q.projectId,
      queryId: q.id,
      createdAt: new Date(cfg.anchor.getTime() - Math.floor(rng.next() * cfg.days * DAY_MS)),
    };
  });
}
