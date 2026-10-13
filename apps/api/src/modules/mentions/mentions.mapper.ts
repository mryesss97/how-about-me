import { type MentionListItem, LanguageCodeSchema, IntentLabelSchema, TopicLabelSchema } from "@how-about-me/contracts";
import { confidenceBand } from "@how-about-me/taxonomy";
import type { HydratedMentions, MentionPageRow } from "./mentions.repository";

type Labeled<L> = { label: L; confidence: number | null };

/**
 * Effective analysis row → MentionListItem (api-contract §7, FR-150/FR-156).
 * Sentiment and safety are mapped independently (BR-017); band is not a probability (BR-020, BR-021).
 */
export function toMentionListItem(row: MentionPageRow, h: HydratedMentions): MentionListItem {
  const status = row.latest_run_status ?? "pending";
  const overall = row.overall_model_confidence;
  const language = LanguageCodeSchema.safeParse(row.language_code);
  const intents = (row.analysis_id ? (h.intents.get(row.analysis_id) ?? []) : []).flatMap((i) => {
    const l = IntentLabelSchema.safeParse(i.label);
    return l.success ? [{ label: l.data, confidence: i.confidence }] : [];
  });
  const topics = (row.analysis_id ? (h.topics.get(row.analysis_id) ?? []) : []).flatMap((t) => {
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
      language: language.success ? language.data : null,
      summary: row.summary,
      overallConfidence: overall,
      confidenceBand: overall == null ? null : confidenceBand(overall),
      hasOverride: row.has_override,
      ...(status === "failed" ? { errorCode: h.errorCodes.get(row.post_id) ?? null } : {}),
    },
  };
}

function labeled<L>(label: L | null, confidence: number | null): Labeled<L> | null {
  return label == null ? null : { label, confidence };
}
