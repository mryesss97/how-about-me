import { Injectable } from "@nestjs/common";
import { normalizeClassifierOutput, type ClassifierOutput } from "@how-about-me/contracts";
import type { IntentLabel, RelevanceLabel, SentimentLabel, TopicLabel } from "@how-about-me/taxonomy";
import { detectLanguage, estimateCostUsd, estimateTokens, round2, seedFrom, seededFloat } from "./deterministic";
import type { AnalysisContext, ClassifierInput, ContentClassifier, Usage } from "./interfaces";

/**
 * Offline classifier used when `PROVIDERS_MODE=fake` (T-013) — docs/02-architecture/07-analysis-pipeline.md §3.
 *
 * Labels come from keyword rules (so a seeded demo dataset shows a believable spread across the six
 * charts) with hash-derived confidences elsewhere. Same text ⇒ same output, on every machine.
 *
 * `provider`/`model`/`promptVersion` are deliberately named `fake` so BR-023 metadata makes it obvious
 * which rows were produced offline and must not be read as real measurements.
 */

type Rule<L extends string> = { pattern: RegExp; label: L };

const IRRELEVANT_RULES: RegExp[] = [/time\s*zone/i, /múi\s*giờ/i, /\bzone\s*\d/i, /safe\s*zone/i];

const SENTIMENT_RULES: Rule<SentimentLabel>[] = [
  { pattern: /(thất vọng|quá tệ|chán|tệ thật|lỗi hoài|trừ tiền|không thấy|chát|bực|😤|😡)/i, label: "negative" },
  { pattern: /(xịn|tuyệt|hay quá|đáng tiền|10 điểm|thân thiện|ổn áp|quá ổn|👏|🔥|❤️)/i, label: "positive" },
];

const INTENT_RULES: Rule<IntentLabel>[] = [
  { pattern: /(sale|inbox ngay|link bio|giá rẻ|kẻo lỡ)/i, label: "spam" },
  { pattern: /(hỗ trợ|cskh|giúp mình|giúp em|support)/i, label: "support_request" },
  { pattern: /(thất vọng|quá tệ|lỗi hoài|trừ tiền|chán|không hài lòng)/i, label: "complaint" },
  { pattern: /(xịn|tuyệt|hay quá|10 điểm|đáng tiền|👏)/i, label: "praise" },
  { pattern: /(định mua|muốn mua|sẽ mua|hóng vé|order|săn vé)/i, label: "purchase_intent" },
  { pattern: /(so với|so sánh|hơn mấy bên|compared)/i, label: "comparison" },
  { pattern: /(cho hỏi|ai biết|bao nhiêu|mấy giờ|có .* không|\?)/i, label: "question" },
  { pattern: /(review|nên đi|recommend|nên mua)/i, label: "recommendation" },
];

const TOPIC_RULES: Rule<TopicLabel>[] = [
  { pattern: /(vé|ticket|early bird)/i, label: "ticket" },
  { pattern: /(giá|phí|chát|đắt|rẻ|bao nhiêu)/i, label: "price" },
  { pattern: /(queue|xếp hàng|chờ .*(tiếng|phút))/i, label: "queue" },
  { pattern: /(thanh toán|trừ tiền|hoàn tiền|refund|payment)/i, label: "payment" },
  { pattern: /(membership|fan club|hội viên)/i, label: "membership" },
  { pattern: /(cskh|staff|nhân viên|hỗ trợ)/i, label: "customer_service" },
  { pattern: /(âm thanh|ánh sáng|line-?up|sân khấu|set ?list)/i, label: "performance" },
  { pattern: /(concert|sự kiện|check-?in|tổ chức|show)/i, label: "event" },
  { pattern: /(ca sĩ|nghệ sĩ|artist|idol)/i, label: "artist" },
  { pattern: /(merch|áo|lightstick|poster)/i, label: "merchandise" },
  { pattern: /(chỗ ngồi|địa điểm|bãi xe|nhà thi đấu|venue)/i, label: "venue" },
];

const MAX_LABELS = 4;

@Injectable()
export class FakeContentClassifier implements ContentClassifier {
  readonly provider = "fake";
  readonly model = "fake-classifier-v1";
  readonly promptVersion = "fake-v1";

  constructor(
    private readonly prices: { inputPer1M: number; outputPer1M: number } = { inputPer1M: 0, outputPer1M: 0 },
  ) {}

  /** Step 1 of the two-step path: the cheap relevance gate (+ language) — doc §2. */
  async relevance(input: ClassifierInput, _ctx: AnalysisContext) {
    const { relevance, language } = this.evaluate(input);
    return { relevance, language, usage: this.usage(input, 24) };
  }

  /** Full structured classification; the shape is the one the real provider must also satisfy. */
  async classify(input: ClassifierInput, _ctx: AnalysisContext): Promise<ClassifierOutput & { usage: Usage }> {
    const evaluated = this.evaluate(input);
    return { ...normalizeClassifierOutput(evaluated), usage: this.usage(input, 96) };
  }

  private evaluate(input: ClassifierInput): ClassifierOutput {
    const text = input.text.trim();
    const seed = seedFrom("classifier", text);
    const language = detectLanguage(text);

    const relevanceLabel = this.relevanceLabel(text);
    const sentimentLabel = firstMatch(SENTIMENT_RULES, text) ?? "neutral";
    const intents = matchAll(INTENT_RULES, text, "information");
    const topics = matchAll(TOPIC_RULES, text, "other");

    return {
      relevance: {
        label: relevanceLabel,
        confidence: round2(confidenceFor(seed, 1, relevanceLabel)),
        explanation: truncate(`Fake classifier: ${explain(relevanceLabel, input)}`, 200),
      },
      sentiment: {
        label: sentimentLabel,
        confidence: round2(seededFloat(seed, 2, sentimentLabel === "neutral" ? 0.55 : 0.74, 0.95)),
      },
      intents: intents.map((label, i) => ({ label, confidence: round2(seededFloat(seed, 10 + i, 0.55, 0.95)) })),
      topics: topics.map((label, i) => ({ label, confidence: round2(seededFloat(seed, 20 + i, 0.55, 0.95)) })),
      language,
      summary: truncate(`Fake summary — ${intents.join(", ")} about ${topics.join(", ")} (${sentimentLabel}).`, 240),
    };
  }

  private relevanceLabel(text: string): RelevanceLabel {
    if (text.length === 0) return "irrelevant";
    if (IRRELEVANT_RULES.some((r) => r.test(text))) return "irrelevant";
    if (text.length < 25) return "uncertain"; // too little context to judge, per the relevance guide
    return "relevant";
  }

  private usage(input: ClassifierInput, outputTokens: number): Usage {
    const inputTokens = estimateTokens(`${input.brandContext}\n${input.text}`);
    return { inputTokens, outputTokens, estimatedCostUsd: estimateCostUsd(inputTokens, outputTokens, this.prices) };
  }
}

/** `relevant` and `irrelevant` are confident calls; `uncertain` must land in the low/medium band (BR-021). */
function confidenceFor(seed: number, salt: number, label: RelevanceLabel): number {
  if (label === "uncertain") return seededFloat(seed, salt, 0.45, 0.68);
  return seededFloat(seed, salt, 0.8, 0.97);
}

function explain(label: RelevanceLabel, input: ClassifierInput): string {
  if (label === "irrelevant") return "the matched term is used in an unrelated sense";
  if (label === "uncertain") return "the post mentions the term but gives too little context";
  const terms = input.matchedTerms.length > 0 ? input.matchedTerms.join(", ") : "the brand";
  return `the post discusses ${terms} in a brand context`;
}

function firstMatch<L extends string>(rules: Rule<L>[], text: string): L | undefined {
  return rules.find((r) => r.pattern.test(text))?.label;
}

function matchAll<L extends string>(rules: Rule<L>[], text: string, fallback: L): L[] {
  const labels = [...new Set(rules.filter((r) => r.pattern.test(text)).map((r) => r.label))].slice(0, MAX_LABELS);
  return labels.length > 0 ? labels : [fallback];
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
