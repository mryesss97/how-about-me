import type { PhraseSentimentResponse, TopicSentimentResponse } from "@how-about-me/contracts";
import type { SentimentLabel } from "@how-about-me/taxonomy";
import { type BubbleDatum, type Counts, dominantSentiment } from "@/features/shared/bubbles/bubble-layout";
import { humanizeLabel } from "./chart-data";

/** Analytics-specific bubble helpers (#222, #243); the shared core lives in `features/shared/bubbles` (#262). */
export * from "@/features/shared/bubbles/bubble-layout";

type Row = TopicSentimentResponse["rows"][number];
type PhraseRow = PhraseSentimentResponse["rows"][number];

function toBubble(key: string, name: string, r: Counts): BubbleDatum[] {
  const d = dominantSentiment(r);
  if (!d) return []; // BR-032: no sentiment → no bubble
  const { positive, neutral, negative, total } = r;
  return [{ key, name, positive, neutral, negative, total, dominant: d.dominant, dominantShare: d.share }];
}

/** Drops topics with no sentiment (no bubble, BR-032) and keeps API order (total DESC, `other` last). */
export function toTopicBubbles(rows: readonly Row[]): BubbleDatum[] {
  return rows.flatMap((r) => toBubble(r.topic, humanizeLabel(r.topic), r));
}

/** #243 (FR-148): phrase rows → bubbles; the phrase is shown verbatim (BR-041 normalised), API order kept. */
export function toPhraseBubbles(rows: readonly PhraseRow[]): BubbleDatum[] {
  return rows.flatMap((r) => toBubble(r.phrase, r.phrase, r));
}

export type BubbleFilter = "all" | SentimentLabel;

export function filterBubbles(data: readonly BubbleDatum[], filter: BubbleFilter): BubbleDatum[] {
  return filter === "all" ? [...data] : data.filter((d) => d.dominant === filter);
}
