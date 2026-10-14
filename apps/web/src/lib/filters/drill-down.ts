import type { IntentLabel, LanguageCode, SafetyLevel, SentimentLabel, TopicLabel } from "@how-about-me/taxonomy";
import type { Filters } from "./schema";

/**
 * Drill-down mapping (FR-142, doc 07 §6): KPI / segment / bucket → the extra Mentions filters that return
 * exactly the counted posts. Feed the result to `toMentionsHref`, which pins the range and drops `compare`.
 * Global filters (incl. relevance, BR-016) are kept by `toMentionsHref`; `extra` overrides the same key.
 */
export type DrillKpiId = "mentions" | "growth" | "positive" | "negative" | "safety" | "complaint" | "severe";

export function kpiDrillDown(id: DrillKpiId): Partial<Filters> {
  switch (id) {
    // Growth opens the current period (same set as Total Relevant Mentions), even with compare on.
    case "mentions":
    case "growth":
      return {};
    case "positive":
      return { sentiment: ["positive"] };
    case "negative":
      return { sentiment: ["negative"] };
    // Sensitive + Severe Rate numerator (BR-017: safety is not sentiment).
    case "safety":
      return { safety: ["sensitive", "severe"] };
    case "severe":
      return { safety: ["severe"] };
    case "complaint":
      return { intent: ["complaint"] };
  }
}

export type SegmentDimension = "sentiment" | "safety" | "topic" | "intent" | "language";

export type SegmentValue = {
  sentiment: SentimentLabel;
  safety: SafetyLevel;
  topic: TopicLabel;
  intent: IntentLabel;
  language: LanguageCode;
};

/**
 * Segment → filter. Returns null for topic "other" (top-12 rest, no matching filter). Intent "other" is a real
 * label; language "other" maps to `language=other`, which the API widens to codes outside the taxonomy (#201).
 */
export function segmentDrillDown<D extends SegmentDimension>(dim: D, value: SegmentValue[D]): Partial<Filters> | null {
  if (dim === "topic" && value === "other") return null;
  return { [dim]: [value] } as Partial<Filters>;
}

/**
 * Topic × sentiment cell / negative contributor (FR-144, T-149) → `topic=[t]` (+ `sentiment=[s]`). Unlike
 * `segmentDrillDown`, `other` is NOT blocked: in the matrix `other` is the real taxonomy label, so
 * `topic=other` returns exactly the counted posts. Without a sentiment (table row header) drills the whole topic.
 */
export function topicSentimentDrillDown(topic: TopicLabel, sentiment?: SentimentLabel): Partial<Filters> {
  return sentiment ? { topic: [topic], sentiment: [sentiment] } : { topic: [topic] };
}

/**
 * Phrase bubble / table row (FR-148, FR-142) → `phrase=[p]` (+ `sentiment=[s]`). Overrides any global `phrase`
 * like `topicSentimentDrillDown` does for `topic`.
 */
export function phraseSentimentDrillDown(phrase: string, sentiment?: SentimentLabel): Partial<Filters> {
  return sentiment ? { phrase: [phrase], sentiment: [sentiment] } : { phrase: [phrase] };
}

/**
 * Keyword share bar (FR-145, T-150) → `queryIds=[id]`. Replaces any global `queryIds`, so the list is exactly the
 * posts with a non-excluded match for that query within the other filters (doc 07 §6).
 */
export function queryDrillDown(queryId: string): Partial<Filters> {
  return { queryIds: [queryId] };
}

/**
 * Bucket i → `[start_i, start_{i+1})`, last bucket ends at `range.to`, clamped to the queried range
 * (`/mentions` is `from` inclusive, `to` exclusive like analytics). Uses the next bucket's start rather than
 * +1h/+1d so tz-aligned buckets stay exact.
 */
export function bucketDrillDown(
  times: readonly string[],
  index: number,
  range: { from: string; to: string },
): Partial<Filters> | null {
  const start = times[index];
  if (start === undefined) return null;
  const rangeFrom = Date.parse(range.from);
  const rangeTo = Date.parse(range.to);
  const next = times[index + 1];
  const from = Math.max(Date.parse(start), rangeFrom);
  const to = Math.min(next === undefined ? rangeTo : Date.parse(next), rangeTo);
  if (!(from < to)) return null;
  return { preset: "custom", from: new Date(from), to: new Date(to) };
}
