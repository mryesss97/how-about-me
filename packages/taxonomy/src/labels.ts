/**
 * Taxonomy v1 — see docs/01-product/08-taxonomy-classification.md.
 * Labels are `const` tuples so both runtime validation (Zod enums) and TS unions derive from one source.
 */
export const RELEVANCE_LABELS = ["relevant", "uncertain", "irrelevant"] as const;
export type RelevanceLabel = (typeof RELEVANCE_LABELS)[number];

export const SENTIMENT_LABELS = ["positive", "neutral", "negative"] as const;
export type SentimentLabel = (typeof SENTIMENT_LABELS)[number];

export const SAFETY_LEVELS = ["safe", "sensitive", "severe"] as const;
export type SafetyLevel = (typeof SAFETY_LEVELS)[number];

export const INTENT_LABELS = [
  "praise",
  "complaint",
  "question",
  "recommendation",
  "purchase_intent",
  "boycott",
  "spam",
  "information",
  "support_request",
  "comparison",
  "other",
] as const;
export type IntentLabel = (typeof INTENT_LABELS)[number];

export const TOPIC_LABELS = [
  "artist",
  "ticket",
  "venue",
  "price",
  "performance",
  "membership",
  "payment",
  "queue",
  "customer_service",
  "event",
  "merchandise",
  "other",
] as const;
export type TopicLabel = (typeof TOPIC_LABELS)[number];

export const LANGUAGE_CODES = ["vi", "en", "ko", "ja", "th", "zh", "other", "unknown"] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

/** Short labelling guides, reused verbatim in the classifier prompt and the QC labelling guide. */
export const INTENT_GUIDE: Record<IntentLabel, string> = {
  praise: "Positive evaluation of the brand, event, artist or service.",
  complaint: "Expresses a problem, dissatisfaction or frustration.",
  question: "Asks for information (schedule, price, how-to, availability).",
  recommendation: "Recommends others to buy/attend, or asks others to.",
  purchase_intent: "Expresses intention to buy tickets, merchandise or membership.",
  boycott: "Refuses to buy/attend or urges others not to.",
  spam: "Promotional, repetitive, scalping or bot-like content unrelated to genuine discussion.",
  information: "Shares news, facts, line-ups, schedules.",
  support_request: "Asks the brand for help with an order, refund, account or ticket delivery.",
  comparison: "Compares with another event, brand or platform.",
  other: "None of the above. Must be the only label when used.",
};

export const TOPIC_GUIDE: Record<TopicLabel, string> = {
  artist: "Performers, line-up, guest artists.",
  ticket: "Ticket availability, sale phases, categories, delivery, resale.",
  venue: "Location, seating, facilities, sound, access, parking.",
  price: "Ticket/merch/membership pricing, value for money.",
  performance: "Show quality, set list, stage production.",
  membership: "Membership, fan club, loyalty program.",
  payment: "Payment methods, failures, refunds.",
  queue: "Waiting lines, online queue, check-in flow.",
  customer_service: "Staff behaviour, support responsiveness, communication.",
  event: "The event as a whole: schedule, announcement, organisation.",
  merchandise: "Merch availability, quality, price.",
  other: "None of the above. Must be the only label when used.",
};

export const RELEVANCE_GUIDE: Record<RelevanceLabel, string> = {
  relevant:
    "About 1Zone and/or Eventista (brand, event, artists, tickets, venue, staff, app, membership) or an experience with them.",
  uncertain: "Mentions the term but context is insufficient or ambiguous.",
  irrelevant:
    "The term refers to something else (e.g. 'time zone', 'zone 1'), or empty/emoji-only text with no brand link.",
};

export const SENTIMENT_GUIDE: Record<SentimentLabel, string> = {
  positive: "Praise, excitement, gratitude, satisfaction, recommendation.",
  neutral: "Informational, questions without emotion, announcements, balanced.",
  negative: "Complaint, disappointment, anger, boycott, sarcasm expressing dissatisfaction.",
};

/** Applies `other`-exclusivity and de-duplication rules (doc 08 §4–§5). Keeps first occurrence order. */
export function normalizeMultiLabel<T extends string>(labels: readonly T[], allowed: readonly T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const l of labels) {
    if (!allowed.includes(l) || seen.has(l)) continue;
    seen.add(l);
    out.push(l);
  }
  const otherIdx = out.indexOf("other" as T);
  if (otherIdx >= 0 && out.length > 1) out.splice(otherIdx, 1);
  return out;
}
