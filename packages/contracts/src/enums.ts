import { z } from "zod";
import {
  INTENT_LABELS,
  LANGUAGE_CODES,
  RELEVANCE_LABELS,
  SAFETY_LEVELS,
  SENTIMENT_LABELS,
  TOPIC_LABELS,
} from "@how-about-me/taxonomy";

export const PLATFORMS = ["threads"] as const;
export const PlatformSchema = z.enum(PLATFORMS);
export type Platform = z.infer<typeof PlatformSchema>;

export const QUERY_TYPES = ["keyword", "topic_tag"] as const;
export const QueryTypeSchema = z.enum(QUERY_TYPES);
export type QueryType = z.infer<typeof QueryTypeSchema>;

export const SEARCH_MODES = ["KEYWORD", "TAG"] as const;
export const SearchModeSchema = z.enum(SEARCH_MODES);
export type SearchMode = z.infer<typeof SearchModeSchema>;

export const SEARCH_TYPES = ["RECENT", "TOP"] as const;
export const SearchTypeSchema = z.enum(SEARCH_TYPES);
export type SearchType = z.infer<typeof SearchTypeSchema>;

export const USER_ROLES = ["admin", "analyst", "viewer"] as const;
export const UserRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const INTEGRATION_STATUSES = ["disconnected", "connected", "expired", "permission_error", "error"] as const;
export const IntegrationStatusSchema = z.enum(INTEGRATION_STATUSES);
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;

export const JOB_STATUSES = ["queued", "running", "success", "partial", "failed", "cancelled"] as const;
export const JobStatusSchema = z.enum(JOB_STATUSES);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JOB_TRIGGERS = ["scheduled", "manual", "backfill", "retry"] as const;
export const JobTriggerSchema = z.enum(JOB_TRIGGERS);
export type JobTrigger = z.infer<typeof JobTriggerSchema>;

export const ANALYSIS_STATUSES = ["pending", "processing", "completed", "failed", "skipped", "stale"] as const;
export const AnalysisStatusSchema = z.enum(ANALYSIS_STATUSES);
export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>;

export const ANALYSIS_TRIGGERS = ["ingest", "content_change", "manual", "bulk", "retry", "version_change"] as const;
export const AnalysisTriggerSchema = z.enum(ANALYSIS_TRIGGERS);
export type AnalysisTrigger = z.infer<typeof AnalysisTriggerSchema>;

export const RelevanceLabelSchema = z.enum(RELEVANCE_LABELS);
export const SentimentLabelSchema = z.enum(SENTIMENT_LABELS);
export const SafetyLevelSchema = z.enum(SAFETY_LEVELS);
export const IntentLabelSchema = z.enum(INTENT_LABELS);
export const TopicLabelSchema = z.enum(TOPIC_LABELS);
export const LanguageCodeSchema = z.enum(LANGUAGE_CODES);

export const OVERRIDE_FIELDS = ["relevance", "sentiment", "safety_level", "intents", "topics"] as const;
export const OverrideFieldSchema = z.enum(OVERRIDE_FIELDS);
export type OverrideField = z.infer<typeof OverrideFieldSchema>;

export const CONFIDENCE_BAND_VALUES = ["high", "medium", "low"] as const;
export const ConfidenceBandSchema = z.enum(CONFIDENCE_BAND_VALUES);
