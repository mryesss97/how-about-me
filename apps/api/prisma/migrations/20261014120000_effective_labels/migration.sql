-- T-142 (#113): effective intents/topics (override > AI, BR-025) — docs/02-architecture/04-data-model.md §5.
-- Hand-written. ⚠ Prisma ignores views: after a future `prisma migrate dev`, REMOVE any generated DROP of
--   "effective_post_analysis", "effective_post_intents" or "effective_post_topics" (doc 04 §6).

-- 1) has_override now also covers active intents/topics overrides. Column list/order/types unchanged.
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
  (o_rel."id" IS NOT NULL OR o_sen."id" IS NOT NULL OR o_saf."id" IS NOT NULL
    OR EXISTS (SELECT 1 FROM "analysis_overrides" o_lab
                WHERE o_lab."post_id" = p."id" AND o_lab."field" IN ('intents', 'topics')
                  AND o_lab."revoked_at" IS NULL))                                       AS has_override
FROM "social_posts" p
LEFT JOIN "post_analyses" a ON a."id" = p."current_analysis_id"
LEFT JOIN "analysis_overrides" o_rel ON o_rel."post_id" = p."id" AND o_rel."field" = 'relevance'    AND o_rel."revoked_at" IS NULL
LEFT JOIN "analysis_overrides" o_sen ON o_sen."post_id" = p."id" AND o_sen."field" = 'sentiment'    AND o_sen."revoked_at" IS NULL
LEFT JOIN "analysis_overrides" o_saf ON o_saf."post_id" = p."id" AND o_saf."field" = 'safety_level' AND o_saf."revoked_at" IS NULL;

-- 2) Effective intents per post: an active `intents` override replaces the AI label set (doc 07 §10).
CREATE VIEW "effective_post_intents" AS
SELECT p."id" AS post_id, i."label"::text AS label, i."confidence" AS confidence, 'ai'::text AS source
  FROM "social_posts" p
  JOIN "analysis_intents" i ON i."analysis_id" = p."current_analysis_id"
 WHERE NOT EXISTS (SELECT 1 FROM "analysis_overrides" o
                    WHERE o."post_id" = p."id" AND o."field" = 'intents' AND o."revoked_at" IS NULL)
UNION ALL
SELECT o."post_id", v.label, NULL::numeric(5,4) AS confidence, 'analyst'::text AS source
  FROM "analysis_overrides" o
 CROSS JOIN LATERAL jsonb_array_elements_text(o."override_value" -> 'value') AS v(label)
 WHERE o."field" = 'intents' AND o."revoked_at" IS NULL;

-- 3) Effective topics per post (same rule).
CREATE VIEW "effective_post_topics" AS
SELECT p."id" AS post_id, t."label"::text AS label, t."confidence" AS confidence, 'ai'::text AS source
  FROM "social_posts" p
  JOIN "analysis_topics" t ON t."analysis_id" = p."current_analysis_id"
 WHERE NOT EXISTS (SELECT 1 FROM "analysis_overrides" o
                    WHERE o."post_id" = p."id" AND o."field" = 'topics' AND o."revoked_at" IS NULL)
UNION ALL
SELECT o."post_id", v.label, NULL::numeric(5,4) AS confidence, 'analyst'::text AS source
  FROM "analysis_overrides" o
 CROSS JOIN LATERAL jsonb_array_elements_text(o."override_value" -> 'value') AS v(label)
 WHERE o."field" = 'topics' AND o."revoked_at" IS NULL;
