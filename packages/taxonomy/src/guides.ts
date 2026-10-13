import {
  INTENT_GUIDE,
  INTENT_LABELS,
  type IntentLabel,
  LANGUAGE_CODES,
  type LanguageCode,
  RELEVANCE_GUIDE,
  RELEVANCE_LABELS,
  SENTIMENT_GUIDE,
  SENTIMENT_LABELS,
  TOPIC_GUIDE,
  TOPIC_LABELS,
} from "./labels.js";
import { TAXONOMY_VERSION } from "./versions.js";

/** Typical Vietnamese cues per intent (doc 08 §4, BR-019). Hints only, not keyword rules. */
export const INTENT_CUES: Readonly<Record<IntentLabel, readonly string[]>> = {
  praise: ["đỉnh", "quá đã", "xịn"],
  complaint: ["tệ", "lỗi", "chờ mãi", "lừa"],
  question: ["có ai biết", "bao giờ", "?"],
  recommendation: ["nên đi", "mua ngay"],
  purchase_intent: ["sẽ mua", "săn vé", "mở bán là chốt"],
  boycott: ["tẩy chay", "không bao giờ mua nữa"],
  spam: ["pass vé giá rẻ inbox", "links only"],
  information: ["line-up", "mở bán lúc"],
  support_request: ["hoàn tiền", "chưa nhận vé", "liên hệ ai"],
  comparison: ["so với", "hơn hẳn"],
  other: [],
};

/** Language detection guide (doc 08 §6). */
export const LANGUAGE_GUIDE: Readonly<Record<LanguageCode, string>> = {
  vi: "Vietnamese.",
  en: "English.",
  ko: "Korean.",
  ja: "Japanese.",
  th: "Thai.",
  zh: "Chinese.",
  other: "Any other identifiable language.",
  unknown: "No identifiable language (e.g. emoji-only).",
};

/** Cross-dimension labelling rules (doc 08 §3–§7). */
export const TAXONOMY_RULES: readonly string[] = [
  'Sarcasm: label sentiment by the intended attitude ("giá vé rẻ quá 🙃 500k một tấm" → negative).',
  "Mixed sentiment: pick the dominant polarity; if truly balanced → neutral.",
  "Intent and topic: at least one label each; `other` must be the only label when used.",
  "`spam` may co-occur with `recommendation` or `information` (scalper posts).",
  "Language: dominant language of the message body; ignore hashtags; emoji-only → unknown.",
  "Summary: one English sentence, ≤ 240 chars, third person, no hashtags.",
  "Relevance explanation: user-facing, ≤ 200 chars, no reasoning traces.",
];

function section(title: string, labels: readonly string[], guide: Readonly<Record<string, string>>): string[] {
  return [`## ${title}`, ...labels.map((l) => `- \`${l}\`: ${guide[l]}`), ""];
}

/** Deterministic markdown guide for the classifier prompt (classifier-v1, English with VI cues). */
export function renderTaxonomyGuide(): string {
  const lines: string[] = [`# ${TAXONOMY_VERSION}`, ""];
  lines.push(...section("Relevance (single)", RELEVANCE_LABELS, RELEVANCE_GUIDE));
  lines.push(...section("Sentiment (single)", SENTIMENT_LABELS, SENTIMENT_GUIDE));
  lines.push("## Intent (multi)");
  for (const l of INTENT_LABELS) {
    const cues = INTENT_CUES[l];
    const suffix = cues.length > 0 ? ` VI cues: ${cues.map((c) => `"${c}"`).join(", ")}.` : "";
    lines.push(`- \`${l}\`: ${INTENT_GUIDE[l]}${suffix}`);
  }
  lines.push("");
  lines.push(...section("Topic (multi)", TOPIC_LABELS, TOPIC_GUIDE));
  lines.push(...section("Language (single)", LANGUAGE_CODES, LANGUAGE_GUIDE));
  lines.push("## Rules", ...TAXONOMY_RULES.map((r) => `- ${r}`));
  return lines.join("\n");
}
