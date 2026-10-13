import type { TopicSentimentResponse } from "@how-about-me/contracts";
import { TOPIC_LABELS } from "@how-about-me/taxonomy";

type Row = TopicSentimentResponse["rows"][number];
const zero = (topic: Row["topic"]): Row => ({
  topic,
  positive: 0,
  neutral: 0,
  negative: 0,
  total: 0,
  negativeShare: null,
});

/** 12 rows like the API (T-149): ticket 1/1/2, venue 0/0/2, price 3/0/1, other 0/0/1 (last), rest zero. */
export function topicSentimentFixture(): TopicSentimentResponse {
  const filled: Row[] = [
    { topic: "ticket", positive: 1, neutral: 1, negative: 2, total: 4, negativeShare: 0.5 },
    { topic: "price", positive: 3, neutral: 0, negative: 1, total: 4, negativeShare: 0.25 },
    { topic: "venue", positive: 0, neutral: 0, negative: 2, total: 2, negativeShare: 1 },
  ];
  const used = new Set<string>([...filled.map((r) => r.topic), "other"]);
  return {
    rows: [
      ...filled,
      ...TOPIC_LABELS.filter((t) => !used.has(t)).map(zero),
      { topic: "other", positive: 0, neutral: 0, negative: 1, total: 1, negativeShare: 1 },
    ],
  };
}

export const emptyTopicSentiment = (): TopicSentimentResponse => ({ rows: TOPIC_LABELS.map(zero) });
