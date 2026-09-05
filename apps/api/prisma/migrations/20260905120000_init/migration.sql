-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "platform" AS ENUM ('threads');

-- CreateEnum
CREATE TYPE "query_type" AS ENUM ('keyword', 'topic_tag');

-- CreateEnum
CREATE TYPE "search_mode" AS ENUM ('KEYWORD', 'TAG');

-- CreateEnum
CREATE TYPE "search_type" AS ENUM ('RECENT', 'TOP');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'analyst', 'viewer');

-- CreateEnum
CREATE TYPE "integration_status" AS ENUM ('disconnected', 'connected', 'expired', 'permission_error', 'error');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('queued', 'running', 'success', 'partial', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "job_trigger" AS ENUM ('scheduled', 'manual', 'backfill', 'retry');

-- CreateEnum
CREATE TYPE "analysis_status" AS ENUM ('pending', 'processing', 'completed', 'failed', 'skipped', 'stale');

-- CreateEnum
CREATE TYPE "analysis_trigger" AS ENUM ('ingest', 'content_change', 'manual', 'bulk', 'retry', 'version_change');

-- CreateEnum
CREATE TYPE "relevance_label" AS ENUM ('relevant', 'uncertain', 'irrelevant');

-- CreateEnum
CREATE TYPE "sentiment_label" AS ENUM ('positive', 'neutral', 'negative');

-- CreateEnum
CREATE TYPE "safety_level" AS ENUM ('safe', 'sensitive', 'severe');

-- CreateEnum
CREATE TYPE "override_field" AS ENUM ('relevance', 'sentiment', 'safety_level', 'intents', 'topics');

-- CreateTable
CREATE TABLE "monitoring_projects" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "monitoring_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "user_role" NOT NULL,
    "invited_email" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("project_id","user_id")
);

-- CreateTable
CREATE TABLE "integration_connections" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "platform" "platform" NOT NULL,
    "status" "integration_status" NOT NULL DEFAULT 'disconnected',
    "account_identifier" TEXT,
    "granted_scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "token_expires_at" TIMESTAMPTZ(6),
    "last_verified_at" TIMESTAMPTZ(6),
    "last_success_at" TIMESTAMPTZ(6),
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "last_error_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_secrets" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "key_id" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "auth_tag" BYTEA NOT NULL,
    "rotated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listening_queries" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "platform" "platform" NOT NULL DEFAULT 'threads',
    "display_name" TEXT NOT NULL,
    "query_value" TEXT NOT NULL,
    "query_type" "query_type" NOT NULL,
    "search_mode" "search_mode" NOT NULL,
    "scheduled_search_type" "search_type" NOT NULL DEFAULT 'RECENT',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "exclude_terms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "include_terms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "poll_interval_seconds" INTEGER NOT NULL DEFAULT 600,
    "overlap_seconds" INTEGER NOT NULL DEFAULT 1200,
    "initial_backfill_days" INTEGER NOT NULL DEFAULT 1,
    "next_run_at" TIMESTAMPTZ(6),
    "last_run_at" TIMESTAMPTZ(6),
    "last_successful_sync_at" TIMESTAMPTZ(6),
    "last_error_at" TIMESTAMPTZ(6),
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "listening_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_posts" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "platform" "platform" NOT NULL,
    "platform_post_id" TEXT NOT NULL,
    "username" TEXT,
    "owner_id" TEXT,
    "text" TEXT,
    "permalink" TEXT,
    "shortcode" TEXT,
    "media_type" TEXT,
    "media_url" TEXT,
    "thumbnail_url" TEXT,
    "alt_text" TEXT,
    "link_attachment_url" TEXT,
    "is_quote_post" BOOLEAN,
    "has_replies" BOOLEAN,
    "quoted_post_id" TEXT,
    "reposted_post_id" TEXT,
    "published_at" TIMESTAMPTZ(6) NOT NULL,
    "content_hash" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "raw_data" JSONB,
    "raw_truncated" BOOLEAN NOT NULL DEFAULT false,
    "current_analysis_id" UUID,
    "latest_run_status" "analysis_status",
    "search_vector" tsvector,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_query_matches" (
    "post_id" UUID NOT NULL,
    "query_id" UUID NOT NULL,
    "first_matched_at" TIMESTAMPTZ(6) NOT NULL,
    "last_matched_at" TIMESTAMPTZ(6) NOT NULL,
    "excluded_by_terms" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "post_query_matches_pkey" PRIMARY KEY ("post_id","query_id")
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "query_id" UUID,
    "status" "job_status" NOT NULL,
    "trigger" "job_trigger" NOT NULL,
    "search_type" "search_type" NOT NULL,
    "search_mode" "search_mode" NOT NULL,
    "window_since" TIMESTAMPTZ(6),
    "window_until" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "pages_fetched" INTEGER NOT NULL DEFAULT 0,
    "records_fetched" INTEGER NOT NULL DEFAULT 0,
    "records_inserted" INTEGER NOT NULL DEFAULT 0,
    "records_updated" INTEGER NOT NULL DEFAULT 0,
    "records_duplicated" INTEGER NOT NULL DEFAULT 0,
    "records_invalid" INTEGER NOT NULL DEFAULT 0,
    "records_excluded" INTEGER NOT NULL DEFAULT 0,
    "provider_requests" INTEGER NOT NULL DEFAULT 0,
    "rate_limit_events" INTEGER NOT NULL DEFAULT 0,
    "provider_usage" JSONB,
    "last_cursor" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "requested_by" UUID,
    "locked_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collector_state" (
    "project_id" UUID NOT NULL,
    "consecutive_provider_failures" INTEGER NOT NULL DEFAULT 0,
    "circuit_open_until" TIMESTAMPTZ(6),
    "circuit_reason" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "collector_state_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "analysis_runs" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "status" "analysis_status" NOT NULL,
    "trigger" "analysis_trigger" NOT NULL,
    "source_content_hash" TEXT NOT NULL,
    "source_revision" INTEGER NOT NULL,
    "effective_version" TEXT NOT NULL,
    "classifier_provider" TEXT,
    "classifier_model" TEXT,
    "prompt_version" TEXT,
    "taxonomy_version" TEXT,
    "safety_provider" TEXT,
    "safety_model" TEXT,
    "safety_policy_version" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "estimated_cost_usd" DECIMAL(12,6),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_reason" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" TEXT,
    "requested_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_analyses" (
    "id" UUID NOT NULL,
    "analysis_run_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "relevance_label" "relevance_label",
    "relevance_confidence" DECIMAL(5,4),
    "relevance_explanation" TEXT,
    "sentiment_label" "sentiment_label",
    "sentiment_confidence" DECIMAL(5,4),
    "safety_level" "safety_level",
    "safety_flagged" BOOLEAN,
    "safety_category_scores" JSONB,
    "language_code" TEXT,
    "summary" TEXT,
    "overall_model_confidence" DECIMAL(5,4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_intents" (
    "analysis_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "confidence" DECIMAL(5,4),

    CONSTRAINT "analysis_intents_pkey" PRIMARY KEY ("analysis_id","label")
);

-- CreateTable
CREATE TABLE "analysis_topics" (
    "analysis_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "confidence" DECIMAL(5,4),

    CONSTRAINT "analysis_topics_pkey" PRIMARY KEY ("analysis_id","label")
);

-- CreateTable
CREATE TABLE "analysis_overrides" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "analysis_id" UUID,
    "field" "override_field" NOT NULL,
    "previous_value" JSONB,
    "override_value" JSONB NOT NULL,
    "reason" TEXT,
    "reviewed_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by" UUID,

    CONSTRAINT "analysis_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "project_id" UUID,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "metadata" JSONB,
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monitoring_projects_slug_key" ON "monitoring_projects"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_email_key" ON "user_profiles"("email");

-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_connections_project_id_platform_key" ON "integration_connections"("project_id", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "integration_secrets_connection_id_key" ON "integration_secrets"("connection_id");

-- CreateIndex
CREATE INDEX "listening_queries_project_id_enabled_next_run_at_idx" ON "listening_queries"("project_id", "enabled", "next_run_at");

-- CreateIndex
CREATE INDEX "social_posts_project_id_published_at_idx" ON "social_posts"("project_id", "published_at" DESC);

-- CreateIndex
CREATE INDEX "social_posts_project_id_first_seen_at_idx" ON "social_posts"("project_id", "first_seen_at" DESC);

-- CreateIndex
CREATE INDEX "social_posts_project_id_latest_run_status_idx" ON "social_posts"("project_id", "latest_run_status");

-- CreateIndex
CREATE INDEX "social_posts_project_id_current_analysis_id_idx" ON "social_posts"("project_id", "current_analysis_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_posts_platform_platform_post_id_key" ON "social_posts"("platform", "platform_post_id");

-- CreateIndex
CREATE INDEX "post_query_matches_query_id_post_id_idx" ON "post_query_matches"("query_id", "post_id");

-- CreateIndex
CREATE INDEX "sync_jobs_project_id_created_at_idx" ON "sync_jobs"("project_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sync_jobs_query_id_created_at_idx" ON "sync_jobs"("query_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs"("status");

-- CreateIndex
CREATE INDEX "analysis_runs_post_id_created_at_idx" ON "analysis_runs"("post_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "analysis_runs_status_created_at_idx" ON "analysis_runs"("status", "created_at");

-- CreateIndex
CREATE INDEX "analysis_runs_source_content_hash_effective_version_idx" ON "analysis_runs"("source_content_hash", "effective_version");

-- CreateIndex
CREATE INDEX "analysis_runs_project_id_status_idx" ON "analysis_runs"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "post_analyses_analysis_run_id_key" ON "post_analyses"("analysis_run_id");

-- CreateIndex
CREATE INDEX "post_analyses_post_id_idx" ON "post_analyses"("post_id");

-- CreateIndex
CREATE INDEX "post_analyses_project_id_relevance_label_idx" ON "post_analyses"("project_id", "relevance_label");

-- CreateIndex
CREATE INDEX "post_analyses_project_id_sentiment_label_idx" ON "post_analyses"("project_id", "sentiment_label");

-- CreateIndex
CREATE INDEX "post_analyses_project_id_safety_level_idx" ON "post_analyses"("project_id", "safety_level");

-- CreateIndex
CREATE INDEX "post_analyses_project_id_language_code_idx" ON "post_analyses"("project_id", "language_code");

-- CreateIndex
CREATE INDEX "analysis_intents_label_analysis_id_idx" ON "analysis_intents"("label", "analysis_id");

-- CreateIndex
CREATE INDEX "analysis_topics_label_analysis_id_idx" ON "analysis_topics"("label", "analysis_id");

-- CreateIndex
CREATE INDEX "analysis_overrides_post_id_field_idx" ON "analysis_overrides"("post_id", "field");

-- CreateIndex
CREATE INDEX "audit_logs_project_id_created_at_idx" ON "audit_logs"("project_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "monitoring_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "monitoring_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_secrets" ADD CONSTRAINT "integration_secrets_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_queries" ADD CONSTRAINT "listening_queries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "monitoring_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "monitoring_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_current_analysis_id_fkey" FOREIGN KEY ("current_analysis_id") REFERENCES "post_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_query_matches" ADD CONSTRAINT "post_query_matches_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_query_matches" ADD CONSTRAINT "post_query_matches_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "listening_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "monitoring_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "listening_queries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collector_state" ADD CONSTRAINT "collector_state_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "monitoring_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "monitoring_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_analyses" ADD CONSTRAINT "post_analyses_analysis_run_id_fkey" FOREIGN KEY ("analysis_run_id") REFERENCES "analysis_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_analyses" ADD CONSTRAINT "post_analyses_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_analyses" ADD CONSTRAINT "post_analyses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "monitoring_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_intents" ADD CONSTRAINT "analysis_intents_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "post_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_topics" ADD CONSTRAINT "analysis_topics_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "post_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_overrides" ADD CONSTRAINT "analysis_overrides_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_overrides" ADD CONSTRAINT "analysis_overrides_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "monitoring_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_overrides" ADD CONSTRAINT "analysis_overrides_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "post_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "monitoring_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

