import {
  type MentionDetail,
  type Override,
  type MentionListItem,
  LanguageCodeSchema,
  SafetyThresholdsSchema,
  IntentLabelSchema,
  TopicLabelSchema,
} from "@how-about-me/contracts";
import { confidenceBand, mapSafetyLevel, SAFETY_POLICY_V1 } from "@how-about-me/taxonomy";
import { z } from "zod";
import type { HydratedMentions, MentionDetailRow, MentionPageRow, MentionRunRow } from "./mentions.repository";

type Labeled<L> = { label: L; confidence: number | null };

/**
 * Effective analysis row → MentionListItem (api-contract §7, FR-150/FR-156).
 * Sentiment and safety are mapped independently (BR-017); band is not a probability (BR-020, BR-021) and uses
 * the bands of the policy the run was analysed with (#220, doc 08 §8).
 */
export function toMentionListItem(row: MentionPageRow, h: HydratedMentions): MentionListItem {
  const status = row.latest_run_status ?? "pending";
  const overall = row.overall_model_confidence;
  const language = LanguageCodeSchema.safeParse(row.language_code);
  const intents = (h.intents.get(row.post_id) ?? []).flatMap((i) => {
    const l = IntentLabelSchema.safeParse(i.label);
    return l.success ? [{ label: l.data, confidence: i.confidence }] : [];
  });
  const topics = (h.topics.get(row.post_id) ?? []).flatMap((t) => {
    const l = TopicLabelSchema.safeParse(t.label);
    return l.success ? [{ label: l.data, confidence: t.confidence }] : [];
  });
  return {
    id: row.post_id,
    platform: row.platform,
    platformPostId: row.platform_post_id,
    username: row.username,
    permalink: row.permalink,
    publishedAt: row.published_at.toISOString(),
    text: row.text,
    mediaType: row.media_type,
    thumbnailUrl: row.thumbnail_url,
    hasReplies: row.has_replies,
    isQuotePost: row.is_quote_post,
    matchedQueries: h.matches.get(row.post_id) ?? [],
    analysis: {
      status,
      source: row.has_override ? (row.analysis_id ? "mixed" : "analyst") : "ai",
      relevance: labeled(row.relevance_label, row.relevance_confidence),
      sentiment: labeled(row.sentiment_label, row.sentiment_confidence),
      safety: row.safety_level ? { level: row.safety_level } : null,
      intents,
      topics,
      // FR-143 (#201): codes outside the taxonomy fold into `other`, matching the chart slice; NULL stays null.
      language: language.success ? language.data : row.language_code ? "other" : null,
      summary: row.summary,
      overallConfidence: overall,
      confidenceBand:
        overall == null ? null : confidenceBand(overall, { high: row.high_band, medium: row.medium_band }),
      hasOverride: row.has_override,
      ...(status === "failed" ? { errorCode: h.errorCodes.get(row.post_id) ?? null } : {}),
    },
  };
}

function labeled<L>(label: L | null, confidence: number | null): Labeled<L> | null {
  return label == null ? null : { label, confidence };
}

const ScoresSchema = z.record(z.string(), z.number());
/** Pipeline stores `{ scores, triggered }` (doc 07 §6); older fixtures use a flat `{category: score}`. */
const StoredScoresSchema = z.union([z.object({ scores: ScoresSchema }).transform((v) => v.scores), ScoresSchema]);

/**
 * T-096 / FR-154: list projection + source extras, current analysis details (explanation, category scores,
 * versions, tokens/cost of the run that produced the current analysis), run history (BR-003) and override
 * history incl. revoked ones (FR-193, T-142).
 * Labels come from the effective view (BR-025); explanation/scores stay those of the AI analysis.
 */
export function toMentionDetail(
  row: MentionDetailRow,
  h: HydratedMentions,
  runs: MentionRunRow[],
  overrides: Override[] = [],
): MentionDetail {
  const item = toMentionListItem(row, h);
  const hasAnalysis = row.analysis_id != null;
  const parsedScores = StoredScoresSchema.safeParse(row.safety_category_scores);
  const scores = hasAnalysis && parsedScores.success ? parsedScores.data : null;
  // #220: thresholds of the policy the run used; missing/invalid row → v1 (never throw on the read path).
  const thresholds = SafetyThresholdsSchema.safeParse(row.safety_thresholds);
  const policy = thresholds.success ? thresholds.data : SAFETY_POLICY_V1;
  // Safety is derived from moderation scores only, never from sentiment (BR-017).
  const triggered = scores
    ? mapSafetyLevel({ categoryScores: scores, flagged: row.safety_flagged ?? false }, policy).triggered
    : null;
  return {
    ...item,
    ownerId: row.owner_id,
    shortcode: row.shortcode,
    mediaUrl: row.media_url,
    altText: row.alt_text,
    linkAttachmentUrl: row.link_attachment_url,
    quotedPostId: row.quoted_post_id,
    repostedPostId: row.reposted_post_id,
    firstSeenAt: row.first_seen_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
    revision: row.revision,
    contentHash: row.content_hash,
    analysis: {
      ...item.analysis,
      relevanceExplanation: hasAnalysis ? row.relevance_explanation : null,
      safetyCategoryScores: scores,
      safetyTriggered: triggered,
      versions: hasAnalysis
        ? {
            classifierProvider: row.classifier_provider,
            classifierModel: row.classifier_model,
            promptVersion: row.prompt_version,
            taxonomyVersion: row.taxonomy_version,
            safetyProvider: row.safety_provider,
            safetyModel: row.safety_model,
            safetyPolicyVersion: row.safety_policy_version,
          }
        : null,
      analyzedAt: hasAnalysis && row.analyzed_at ? row.analyzed_at.toISOString() : null,
      tokens: hasAnalysis ? { input: row.input_tokens, output: row.output_tokens } : null,
      estimatedCostUsd: hasAnalysis ? row.estimated_cost_usd : null,
    },
    runs: runs.map((r) => ({
      id: r.id,
      status: r.status,
      trigger: r.trigger,
      effectiveVersion: r.effectiveVersion,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      errorCode: r.errorCode,
      estimatedCostUsd: r.estimatedCostUsd,
    })),
    overrides,
  };
}
