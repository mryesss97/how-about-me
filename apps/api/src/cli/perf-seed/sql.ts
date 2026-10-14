/**
 * Batched multi-row INSERT builders for the perf seed (T-097). All values are bound parameters via `Prisma.sql`;
 * table/column/cast names are fixed literals of this file (never input).
 */
import { Prisma } from "@prisma/client";
import type {
  AnalysisRow,
  AuditRow,
  Fixture,
  LabelRow,
  MatchRow,
  OverrideRow,
  PostRow,
  RunRow,
  SyncJobRow,
} from "./generate";

/** Postgres caps bind parameters at 65 535 per statement; stay well below. */
export const MAX_BIND_PARAMS = 30_000;

type Column = readonly [name: string, cast: string];
export type TableSpec<R> = { table: string; columns: readonly Column[]; values: (r: R) => unknown[] };

/** Splits rows so each statement binds at most `maxParams` parameters. */
export function batchRows<R>(rows: readonly R[], columnCount: number, maxParams = MAX_BIND_PARAMS): R[][] {
  const per = Math.max(1, Math.floor(maxParams / columnCount));
  const out: R[][] = [];
  for (let i = 0; i < rows.length; i += per) out.push(rows.slice(i, i + per));
  return out;
}

export function insertStatements<R>(spec: TableSpec<R>, rows: readonly R[]): Prisma.Sql[] {
  const cols = Prisma.raw(spec.columns.map(([n]) => `"${n}"`).join(", "));
  return batchRows(rows, spec.columns.length).map((batch) => {
    const tuples = batch.map((r) => {
      const v = spec.values(r);
      return Prisma.sql`(${Prisma.join(spec.columns.map(([, cast], i) => Prisma.sql`${v[i]}::${Prisma.raw(cast)}`))})`;
    });
    return Prisma.sql`INSERT INTO ${Prisma.raw(`"${spec.table}"`)} (${cols}) VALUES ${Prisma.join(tuples)}`;
  });
}

export const USERS: TableSpec<Fixture["users"][number]> = {
  table: "user_profiles",
  columns: [
    ["id", "uuid"],
    ["email", "text"],
    ["display_name", "text"],
    ["updated_at", "timestamptz"],
  ],
  values: (u) => [u.id, u.email, u.email.split("@")[0], new Date(0)],
};

export const PROJECTS: TableSpec<Fixture["projects"][number]> = {
  table: "monitoring_projects",
  columns: [
    ["id", "uuid"],
    ["name", "text"],
    ["slug", "text"],
    ["updated_at", "timestamptz"],
  ],
  values: (p) => [p.id, p.name, p.slug, new Date(0)],
};

export const MEMBERS: TableSpec<{ projectId: string; userId: string; role: string }> = {
  table: "project_members",
  columns: [
    ["project_id", "uuid"],
    ["user_id", "uuid"],
    ["role", "user_role"],
    ["updated_at", "timestamptz"],
  ],
  values: (m) => [m.projectId, m.userId, m.role, new Date(0)],
};

export const QUERIES: TableSpec<Fixture["queries"][number]> = {
  table: "listening_queries",
  columns: [
    ["id", "uuid"],
    ["project_id", "uuid"],
    ["display_name", "text"],
    ["query_value", "text"],
    ["query_type", "query_type"],
    ["search_mode", "search_mode"],
    ["updated_at", "timestamptz"],
    ["deleted_at", "timestamptz"],
  ],
  values: (q) => [
    q.id,
    q.projectId,
    q.name,
    q.value,
    "keyword",
    "KEYWORD",
    new Date(0),
    q.deleted ? new Date(0) : null,
  ],
};

export const POSTS: TableSpec<PostRow> = {
  table: "social_posts",
  columns: [
    ["id", "uuid"],
    ["project_id", "uuid"],
    ["platform", "platform"],
    ["platform_post_id", "text"],
    ["username", "text"],
    ["text", "text"],
    ["permalink", "text"],
    ["published_at", "timestamptz"],
    ["content_hash", "text"],
    ["current_analysis_id", "uuid"],
    ["latest_run_status", "analysis_status"],
    ["first_seen_at", "timestamptz"],
    ["last_seen_at", "timestamptz"],
    ["updated_at", "timestamptz"],
  ],
  values: (p) => [
    p.id,
    p.projectId,
    "threads",
    p.platformPostId,
    p.username,
    p.text,
    `https://www.threads.net/@${p.username}/post/${p.platformPostId}`,
    p.publishedAt,
    p.contentHash,
    p.currentAnalysisId,
    p.latestRunStatus,
    p.firstSeenAt,
    p.firstSeenAt,
    p.firstSeenAt,
  ],
};

export const MATCHES: TableSpec<MatchRow> = {
  table: "post_query_matches",
  columns: [
    ["post_id", "uuid"],
    ["query_id", "uuid"],
    ["first_matched_at", "timestamptz"],
    ["last_matched_at", "timestamptz"],
    ["excluded_by_terms", "boolean"],
  ],
  values: (m) => [m.postId, m.queryId, m.matchedAt, m.matchedAt, m.excluded],
};

export const RUNS: TableSpec<RunRow> = {
  table: "analysis_runs",
  columns: [
    ["id", "uuid"],
    ["post_id", "uuid"],
    ["project_id", "uuid"],
    ["status", "analysis_status"],
    ["trigger", "analysis_trigger"],
    ["source_content_hash", "text"],
    ["source_revision", "int"],
    ["effective_version", "text"],
    ["classifier_provider", "text"],
    ["classifier_model", "text"],
    ["started_at", "timestamptz"],
    ["completed_at", "timestamptz"],
    ["attempt_count", "int"],
    ["error_code", "text"],
    ["created_at", "timestamptz"],
  ],
  values: (r) => [
    r.id,
    r.postId,
    r.projectId,
    r.status,
    "ingest",
    r.contentHash,
    1,
    "perf-v1",
    "fake",
    "perf-model",
    r.status === "pending" ? null : r.createdAt,
    r.completedAt,
    r.status === "pending" ? 0 : 1,
    r.errorCode,
    r.createdAt,
  ],
};

export const ANALYSES: TableSpec<AnalysisRow> = {
  table: "post_analyses",
  columns: [
    ["id", "uuid"],
    ["analysis_run_id", "uuid"],
    ["post_id", "uuid"],
    ["project_id", "uuid"],
    ["relevance_label", "relevance_label"],
    ["relevance_confidence", "numeric"],
    ["sentiment_label", "sentiment_label"],
    ["sentiment_confidence", "numeric"],
    ["safety_level", "safety_level"],
    ["safety_flagged", "boolean"],
    ["language_code", "text"],
    ["summary", "text"],
    ["overall_model_confidence", "numeric"],
    ["created_at", "timestamptz"],
  ],
  values: (a) => [
    a.id,
    a.runId,
    a.postId,
    a.projectId,
    a.relevance,
    a.relevanceConfidence,
    a.sentiment,
    a.sentimentConfidence,
    a.safety,
    a.safety !== "safe",
    a.language,
    "synthetic perf summary",
    a.overall,
    a.createdAt,
  ],
};

const labelSpec = (table: string): TableSpec<LabelRow> => ({
  table,
  columns: [
    ["analysis_id", "uuid"],
    ["label", "text"],
    ["confidence", "numeric"],
  ],
  values: (l) => [l.analysisId, l.label, l.confidence],
});
export const INTENTS = labelSpec("analysis_intents");
export const TOPICS = labelSpec("analysis_topics");

export const OVERRIDES: TableSpec<OverrideRow> = {
  table: "analysis_overrides",
  columns: [
    ["id", "uuid"],
    ["post_id", "uuid"],
    ["project_id", "uuid"],
    ["analysis_id", "uuid"],
    ["field", "override_field"],
    ["override_value", "jsonb"],
    ["reason", "text"],
    ["reviewed_by", "uuid"],
    ["created_at", "timestamptz"],
    ["revoked_at", "timestamptz"],
    ["revoked_by", "uuid"],
  ],
  values: (o) => [
    o.id,
    o.postId,
    o.projectId,
    o.analysisId,
    o.field,
    JSON.stringify({ value: o.value }),
    "perf seed",
    o.reviewedBy,
    o.createdAt,
    o.revokedAt,
    o.revokedAt ? o.reviewedBy : null,
  ],
};

export const AUDIT_LOGS: TableSpec<AuditRow> = {
  table: "audit_logs",
  columns: [
    ["id", "uuid"],
    ["project_id", "uuid"],
    ["actor_user_id", "uuid"],
    ["action", "text"],
    ["entity_type", "text"],
    ["entity_id", "text"],
    ["created_at", "timestamptz"],
  ],
  values: (a) => [a.id, a.projectId, a.actorUserId, a.action, "monitoring_project", a.projectId, a.createdAt],
};

export const SYNC_JOBS: TableSpec<SyncJobRow> = {
  table: "sync_jobs",
  columns: [
    ["id", "uuid"],
    ["project_id", "uuid"],
    ["query_id", "uuid"],
    ["status", "job_status"],
    ["trigger", "job_trigger"],
    ["search_type", "search_type"],
    ["search_mode", "search_mode"],
    ["started_at", "timestamptz"],
    ["completed_at", "timestamptz"],
    ["created_at", "timestamptz"],
  ],
  values: (j) => [
    j.id,
    j.projectId,
    j.queryId,
    "success",
    "scheduled",
    "RECENT",
    "KEYWORD",
    j.createdAt,
    j.createdAt,
    j.createdAt,
  ],
};

/** Data tables only (never `_prisma_migrations`); CASCADE reaches every child table. */
export const TRUNCATE_SQL = Prisma.sql`TRUNCATE TABLE "monitoring_projects", "user_profiles", "audit_logs" CASCADE`;

export const ANALYZE_TABLES = [
  "social_posts",
  "post_query_matches",
  "analysis_runs",
  "post_analyses",
  "analysis_intents",
  "analysis_topics",
  "analysis_phrases",
  "analysis_overrides",
  "audit_logs",
  "sync_jobs",
  "listening_queries",
] as const;
