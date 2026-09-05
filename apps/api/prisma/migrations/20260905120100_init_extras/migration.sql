-- Hand-written additions that Prisma's schema language cannot express (docs/02-architecture/04-data-model.md §6).
-- ⚠ Prisma Migrate is declarative: after `prisma migrate dev`, REVIEW the generated SQL and remove any DROP of the
--   objects below (partial indexes, generated column, view) before committing. Tracked in T-007.

-- 1) listening_queries: unique active query per (project, platform, type, lower(value)) — BR-006
CREATE UNIQUE INDEX "listening_queries_active_unique"
  ON "listening_queries" ("project_id", "platform", "query_type", lower("query_value"))
  WHERE "deleted_at" IS NULL;

-- 2) analysis_runs: never two open runs for the same content+version — FR-088 / BR-024
CREATE UNIQUE INDEX "analysis_runs_open_unique"
  ON "analysis_runs" ("post_id", "source_content_hash", "effective_version")
  WHERE "status" IN ('pending', 'processing');

-- 3) analysis_overrides: one active override per (post, field) — P1
CREATE UNIQUE INDEX "analysis_overrides_active_unique"
  ON "analysis_overrides" ("post_id", "field")
  WHERE "revoked_at" IS NULL;

-- 4) social_posts.search_vector → generated column + GIN (FR-161)
ALTER TABLE "social_posts" DROP COLUMN "search_vector";
ALTER TABLE "social_posts"
  ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce("text", ''))) STORED;
CREATE INDEX "social_posts_search_vector_idx" ON "social_posts" USING GIN ("search_vector");

-- 5) current_analysis_id FK deferrable so a run result and the pointer can be written in one transaction (FR-114)
ALTER TABLE "social_posts" DROP CONSTRAINT "social_posts_current_analysis_id_fkey";
ALTER TABLE "social_posts"
  ADD CONSTRAINT "social_posts_current_analysis_id_fkey"
  FOREIGN KEY ("current_analysis_id") REFERENCES "post_analyses"("id")
  ON DELETE SET NULL ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- 6) effective_post_analysis view — override > latest AI (BR-025), docs/02-architecture/04-data-model.md §5
CREATE OR REPLACE VIEW "effective_post_analysis" AS
SELECT
  p."id"                AS post_id,
  p."project_id",
  p."published_at",
  p."first_seen_at",
  p."latest_run_status",
  COALESCE((o_rel."override_value" ->> 'value')::relevance_label, a."relevance_label")  AS relevance_label,
  a."relevance_confidence",
  COALESCE((o_sen."override_value" ->> 'value')::sentiment_label, a."sentiment_label")  AS sentiment_label,
  a."sentiment_confidence",
  COALESCE((o_saf."override_value" ->> 'value')::safety_level, a."safety_level")        AS safety_level,
  a."language_code",
  a."summary",
  a."overall_model_confidence",
  a."id"                AS analysis_id,
  (o_rel."id" IS NOT NULL OR o_sen."id" IS NOT NULL OR o_saf."id" IS NOT NULL)          AS has_override
FROM "social_posts" p
LEFT JOIN "post_analyses" a ON a."id" = p."current_analysis_id"
LEFT JOIN "analysis_overrides" o_rel ON o_rel."post_id" = p."id" AND o_rel."field" = 'relevance'    AND o_rel."revoked_at" IS NULL
LEFT JOIN "analysis_overrides" o_sen ON o_sen."post_id" = p."id" AND o_sen."field" = 'sentiment'    AND o_sen."revoked_at" IS NULL
LEFT JOIN "analysis_overrides" o_saf ON o_saf."post_id" = p."id" AND o_saf."field" = 'safety_level' AND o_saf."revoked_at" IS NULL;
