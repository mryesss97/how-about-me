/**
 * Demo seed (#294): analysis settings, demo listening queries, sync jobs and audit entries. Pure, deterministic.
 */
import {
  CONFIDENCE_BANDS,
  SAFETY_POLICY_V1,
  safetyPolicyVersionOf,
  type SafetyThreshold,
} from "@how-about-me/taxonomy";
import { QueryType } from "@prisma/client";
import { normalizeQuery } from "../../common/queries/normalize-query";
import type { Rng } from "../perf-seed/prng";
import type {
  DemoAnalysisSetting,
  DemoAuditLog,
  DemoInput,
  DemoOverride,
  DemoQuery,
  DemoSyncJob,
  QueryKind,
} from "./types";

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;
/** v2 of the analysis policy becomes active 10 days before the anchor (BR-018: settings are append-only). */
export const V2_OFFSET = 10 * DAY;
export const V2_BANDS = { high: 0.85, medium: 0.65 } as const;

export const at = (anchor: Date, msBefore: number) => new Date(anchor.getTime() - msBefore);

/** BR-018 / BR-021: v1 = taxonomy defaults, v2 = tighter bands + a lower harassment threshold. */
export function buildAnalysisSettings(ids: Rng, input: DemoInput): DemoAnalysisSetting[] {
  const v2Thresholds: Record<string, SafetyThreshold> = { ...SAFETY_POLICY_V1 };
  v2Thresholds.harassment = { sensitive: 0.45, severe: null };
  return [
    {
      id: ids.uuid(),
      version: 1,
      policyVersion: safetyPolicyVersionOf(1),
      confidenceBands: { ...CONFIDENCE_BANDS },
      safetyThresholds: { ...SAFETY_POLICY_V1 },
      createdBy: input.users.admin,
      createdAt: at(input.anchor, 31 * DAY),
    },
    {
      id: ids.uuid(),
      version: 2,
      policyVersion: safetyPolicyVersionOf(2),
      confidenceBands: { ...V2_BANDS },
      safetyThresholds: v2Thresholds,
      createdBy: input.users.admin,
      createdAt: at(input.anchor, V2_OFFSET),
    },
  ];
}

type QuerySpec = {
  displayName: string;
  value: string;
  type: QueryKind;
  poll: number;
  enabled?: boolean;
  include?: string[];
  exclude?: string[];
  failing?: boolean;
  deletedDaysAgo?: number;
};

/** 4 demo queries on top of the 4 base ones → 8 in total (one disabled, one soft-deleted, one failing). */
const QUERY_SPECS: readonly QuerySpec[] = [
  { displayName: "fan meeting", value: "fan meeting", type: "keyword", poll: 300, exclude: ["pass vé"], failing: true },
  { displayName: "#lightstick", value: "#lightstick", type: "topic_tag", poll: 1800 },
  { displayName: "hoàn vé", value: "hoàn vé", type: "keyword", poll: 3600, enabled: false },
  {
    displayName: "eventista refund",
    value: "eventista refund",
    type: "keyword",
    poll: 600,
    deletedDaysAgo: 5,
  },
];

export function buildDemoQueries(ids: Rng, input: DemoInput): DemoQuery[] {
  const { anchor } = input;
  return QUERY_SPECS.map((s, i) => {
    // BR-004 / BR-005: same normalisation as the API.
    const { queryValue, searchMode } = normalizeQuery({
      queryValue: s.value,
      queryType: s.type === "keyword" ? QueryType.keyword : QueryType.topic_tag,
    });
    const active = (s.enabled ?? true) && s.deletedDaysAgo === undefined;
    return {
      id: ids.uuid(),
      displayName: s.displayName,
      queryType: s.type,
      queryValue,
      searchMode,
      enabled: s.enabled ?? true,
      includeTerms: s.include ?? [],
      excludeTerms: s.exclude ?? [],
      pollIntervalSeconds: s.poll,
      nextRunAt: active ? new Date(anchor.getTime() + s.poll * 1000) : null,
      lastRunAt: at(anchor, (s.poll * 1000) / 2),
      lastSuccessfulSyncAt: at(anchor, s.failing ? 2 * HOUR : (s.poll * 1000) / 2),
      lastErrorAt: s.failing ? at(anchor, 5 * MIN) : null,
      lastErrorCode: s.failing ? "THREADS_RATE_LIMITED" : null,
      lastErrorMessage: s.failing ? "Threads rate limit reached (demo)" : null,
      consecutiveFailures: s.failing ? 2 : 0,
      createdBy: i % 2 === 0 ? input.users.admin : input.users.analyst,
      createdAt: at(anchor, 30 * DAY + HOUR * (i + 1)),
      deletedAt: s.deletedDaysAgo === undefined ? null : at(anchor, s.deletedDaysAgo * DAY),
    };
  });
}

const JOB_ERRORS = ["THREADS_RATE_LIMITED", "THREADS_TIMEOUT", "THREADS_UPSTREAM_ERROR"] as const;

type JobQuery = { id: string; searchMode: "KEYWORD" | "TAG"; deletedAt: Date | null };

/** ~120 jobs over 30 days; exactly 1 running + 1 queued (most recent). Counters: fetched = Σ outcome buckets. */
export function buildSyncJobs(rng: Rng, ids: Rng, input: DemoInput, queries: readonly JobQuery[]): DemoSyncJob[] {
  const { anchor, users } = input;
  const jobs: DemoSyncJob[] = [];
  const total = 120;
  for (let i = 0; i < total; i++) {
    const q = rng.pick(queries);
    // Soft-deleted queries only have jobs from before their deletion.
    const minAgo = q.deletedAt ? anchor.getTime() - q.deletedAt.getTime() + HOUR : 30 * MIN;
    const ago = i === 0 ? 2 * MIN : i === 1 ? 1 * MIN : rng.int(minAgo, 30 * DAY - HOUR);
    const createdAt = at(anchor, ago);
    const status: DemoSyncJob["status"] =
      i === 0
        ? "running"
        : i === 1
          ? "queued"
          : rng.weighted([
              ["success", 78],
              ["partial", 10],
              ["failed", 8],
              ["cancelled", 4],
            ] as const);
    const trigger: DemoSyncJob["trigger"] =
      status === "queued"
        ? "manual"
        : rng.weighted([
            ["scheduled", 80],
            ["manual", 10],
            ["backfill", 5],
            ["retry", 5],
          ] as const);
    const done = status !== "running" && status !== "queued";
    const fetched = status === "queued" || status === "cancelled" ? 0 : rng.int(0, 60);
    const inserted = Math.floor(fetched * rng.next() * 0.5);
    const updated = Math.floor((fetched - inserted) * rng.next() * 0.3);
    const invalid = status === "partial" ? Math.min(rng.int(1, 3), fetched - inserted - updated) : 0;
    const excluded = Math.floor((fetched - inserted - updated - invalid) * rng.next() * 0.2);
    const duplicated = fetched - inserted - updated - invalid - excluded;
    const errorCode = status === "failed" || status === "partial" ? rng.pick(JOB_ERRORS) : null;
    const pages = fetched === 0 ? (status === "failed" ? 1 : 0) : Math.ceil(fetched / 25);
    const startedAt = status === "queued" ? null : new Date(createdAt.getTime() + rng.int(1, 20) * 1000);
    jobs.push({
      id: ids.uuid(),
      queryId: q.id,
      status,
      trigger,
      searchType: trigger === "backfill" ? "TOP" : "RECENT",
      searchMode: q.searchMode,
      windowSince: new Date(createdAt.getTime() - (trigger === "backfill" ? DAY : 20 * MIN)),
      windowUntil: createdAt,
      startedAt,
      completedAt: done && startedAt ? new Date(startedAt.getTime() + rng.int(2, 90) * 1000) : null,
      pagesFetched: pages,
      recordsFetched: fetched,
      recordsInserted: inserted,
      recordsUpdated: updated,
      recordsDuplicated: duplicated,
      recordsInvalid: invalid,
      recordsExcluded: excluded,
      providerRequests: pages + (errorCode ? 1 : 0),
      rateLimitEvents: errorCode === "THREADS_RATE_LIMITED" ? rng.int(1, 3) : 0,
      lastCursor: pages > 1 ? `demo_cursor_${i}` : null,
      errorCode,
      errorMessage: errorCode ? `${errorCode} (demo)` : null,
      requestedBy: trigger === "manual" || trigger === "backfill" ? rng.pick([users.admin, users.analyst]) : null,
      createdAt,
    });
  }
  return jobs;
}

type AuditRefs = {
  queryIds: readonly string[];
  // #393: field + post id so demo override rows read "Ghi đè · {trường}" and link to the mention.
  overrides: readonly Pick<DemoOverride, "id" | "postId" | "field">[];
  postIds: readonly string[];
  settingsId: string;
};

/** ~40 entries using only action names the API already writes (no invented actions). */
export function buildAuditLogs(rng: Rng, ids: Rng, input: DemoInput, refs: AuditRefs): DemoAuditLog[] {
  const { users, projectId } = input;
  const actors = [users.admin, users.admin, users.analyst];
  const kinds: readonly (() => Pick<DemoAuditLog, "action" | "entityType" | "entityId" | "metadata">)[] = [
    () => ({ action: "query.created", entityType: "query", entityId: rng.pick(refs.queryIds), metadata: {} }),
    () => ({ action: "member.added", entityType: "member", entityId: users.analyst, metadata: { role: "analyst" } }),
    () => ({
      action: "member.role_changed",
      entityType: "member",
      entityId: users.viewer,
      metadata: { from: "analyst", to: "viewer" },
    }),
    () => {
      const o = rng.pick(refs.overrides);
      return {
        action: "override.created",
        entityType: "analysis_override",
        entityId: o.id,
        metadata: { field: o.field, postIds: [o.postId] },
      };
    },
    () => {
      const o = rng.pick(refs.overrides);
      return {
        action: "override.revoked",
        entityType: "analysis_override",
        entityId: o.id,
        metadata: { field: o.field, postIds: [o.postId] },
      };
    },
    () => ({
      action: "project.updated",
      entityType: "monitoring_project",
      entityId: projectId,
      metadata: { changes: ["settings.landingTerms"] },
    }),
    () => ({
      action: "analysis_settings.updated",
      entityType: "analysis_settings",
      entityId: refs.settingsId,
      metadata: {},
    }),
    () => ({
      action: "analysis.reanalyze_requested",
      entityType: "social_post",
      entityId: rng.pick(refs.postIds),
      metadata: {},
    }),
    () => ({ action: "review.marked", entityType: "social_post", entityId: rng.pick(refs.postIds), metadata: {} }),
    () => ({
      action: "mentions.exported",
      entityType: "monitoring_project",
      entityId: projectId,
      metadata: { format: "csv" },
    }),
  ];
  const logs: DemoAuditLog[] = [];
  for (let i = 0; i < 40; i++) {
    const kind = kinds[i % kinds.length];
    if (!kind) continue;
    const entry = kind();
    logs.push({
      id: ids.uuid(),
      actorUserId: rng.pick(actors),
      ...entry,
      // `demo: true` lets the loader find and replace these rows on re-run.
      metadata: { ...entry.metadata, demo: true },
      requestId: `demo-req-${String(i).padStart(3, "0")}`,
      createdAt: at(input.anchor, rng.int(10 * MIN, 30 * DAY)),
    });
  }
  return logs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
