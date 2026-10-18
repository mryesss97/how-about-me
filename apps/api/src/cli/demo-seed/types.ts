/**
 * Plain row shapes produced by the demo-seed generator (#294). No Prisma types here: the generator is pure and the
 * loader (`../demo-seed.ts`) maps these onto `createMany` inputs.
 */
import type { SafetyThreshold } from "@how-about-me/taxonomy";
import type { DemoLang } from "./text-bank";

export type DemoUsers = { admin: string; analyst: string; viewer: string };
export type QueryKind = "keyword" | "topic_tag";
export type BaseQuery = { id: string; queryType: QueryKind; queryValue: string };

export type DemoInput = {
  seed: number;
  /** Upper bound of every generated timestamp; posts fall in [anchor − 30 d, anchor). */
  anchor: Date;
  projectId: string;
  users: DemoUsers;
  /** Queries created by `prisma/seed.ts` (1zone / eventista, keyword + tag), already normalised. */
  baseQueries: readonly BaseQuery[];
};

export type RunStatus = "pending" | "processing" | "completed" | "failed" | "skipped" | "stale";
export type RunTrigger = "ingest" | "content_change" | "manual" | "bulk" | "retry" | "version_change";
export type Relevance = "relevant" | "uncertain" | "irrelevant";
export type Sentiment = "positive" | "neutral" | "negative";
export type Safety = "safe" | "sensitive" | "severe";
export type OverrideFieldName = "relevance" | "sentiment" | "safety_level" | "intents" | "topics";

export type DemoQuery = {
  id: string;
  displayName: string;
  queryType: QueryKind;
  queryValue: string;
  searchMode: "KEYWORD" | "TAG";
  enabled: boolean;
  includeTerms: string[];
  excludeTerms: string[];
  pollIntervalSeconds: number;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastSuccessfulSyncAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  consecutiveFailures: number;
  createdBy: string;
  createdAt: Date;
  deletedAt: Date | null;
};

export type DemoPost = {
  id: string;
  platformPostId: string;
  username: string;
  ownerId: string;
  text: string;
  permalink: string;
  shortcode: string;
  lang: DemoLang;
  publishedAt: Date;
  contentHash: string;
  revision: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  latestRunStatus: RunStatus;
  currentAnalysisId: string | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
};

export type DemoMatch = {
  postId: string;
  queryId: string;
  firstMatchedAt: Date;
  lastMatchedAt: Date;
  excludedByTerms: boolean;
};

export type DemoRun = {
  id: string;
  postId: string;
  status: RunStatus;
  trigger: RunTrigger;
  sourceContentHash: string;
  sourceRevision: number;
  effectiveVersion: string;
  policyVersion: string;
  startedAt: Date | null;
  completedAt: Date | null;
  inputTokens: number | null;
  outputTokens: number | null;
  attemptCount: number;
  skippedReason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  lockedAt: Date | null;
  lockedBy: string | null;
  requestedBy: string | null;
  createdAt: Date;
};

export type DemoAnalysis = {
  id: string;
  analysisRunId: string;
  postId: string;
  relevanceLabel: Relevance;
  relevanceConfidence: number;
  relevanceExplanation: string;
  sentimentLabel: Sentiment;
  sentimentConfidence: number;
  safetyLevel: Safety;
  safetyFlagged: boolean;
  safetyCategoryScores: Record<string, number>;
  languageCode: DemoLang;
  summary: string;
  overallModelConfidence: number;
  createdAt: Date;
  intents: { label: string; confidence: number }[];
  topics: { label: string; confidence: number }[];
  /** Normalised (BR-041), ≤ 5, in position order. */
  phrases: string[];
};

export type DemoOverride = {
  id: string;
  postId: string;
  analysisId: string | null;
  field: OverrideFieldName;
  previousValue: { value: string | string[] };
  overrideValue: { value: string | string[] };
  reason: string;
  reviewedBy: string;
  createdAt: Date;
  revokedAt: Date | null;
  revokedBy: string | null;
};

export type DemoSyncJob = {
  id: string;
  queryId: string;
  status: "queued" | "running" | "success" | "partial" | "failed" | "cancelled";
  trigger: "scheduled" | "manual" | "backfill" | "retry";
  searchType: "RECENT" | "TOP";
  searchMode: "KEYWORD" | "TAG";
  windowSince: Date;
  windowUntil: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  pagesFetched: number;
  recordsFetched: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsDuplicated: number;
  recordsInvalid: number;
  recordsExcluded: number;
  providerRequests: number;
  rateLimitEvents: number;
  lastCursor: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  requestedBy: string | null;
  createdAt: Date;
};

export type DemoAuditLog = {
  id: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  requestId: string;
  createdAt: Date;
};

export type DemoAnalysisSetting = {
  id: string;
  version: number;
  policyVersion: string;
  confidenceBands: { high: number; medium: number };
  safetyThresholds: Record<string, SafetyThreshold>;
  createdBy: string;
  createdAt: Date;
};

export type DemoDataset = {
  analysisSettings: DemoAnalysisSetting[];
  queries: DemoQuery[];
  posts: DemoPost[];
  matches: DemoMatch[];
  runs: DemoRun[];
  analyses: DemoAnalysis[];
  overrides: DemoOverride[];
  syncJobs: DemoSyncJob[];
  auditLogs: DemoAuditLog[];
  collectorState: { consecutiveProviderFailures: number };
  projectSettings: { phraseMinMentions: number; landingTerms: string[] };
};
