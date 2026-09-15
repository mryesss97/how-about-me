import { Injectable } from "@nestjs/common";
import { seedFrom, seededFloat, round2 } from "./deterministic";
import type { AnalysisContext, SafetyProvider, SafetyProviderResult } from "./interfaces";

/**
 * Offline moderation provider used when `PROVIDERS_MODE=fake` (T-013).
 *
 * Scores come from keyword rules first (so a demo dataset reliably produces one post of each safety
 * level) and from the content hash otherwise — never from `Math.random`, so the analytics QA checklist
 * can assert exact numbers. Sentiment is deliberately not an input: safety ≠ sentiment (BR-017).
 */

/** Keyword → moderation category, mirroring the OpenAI category names the policy maps (BR-018). */
const RULES: { pattern: RegExp; category: string; score: number }[] = [
  { pattern: word("giết|đâm chết|đánh chết|kill you|beat him up"), category: "violence", score: 0.92 },
  { pattern: word("đm|dmm|đồ óc chó|thằng ngu|stupid bitch"), category: "harassment", score: 0.62 },
  { pattern: word("(bọn|lũ) (bắc|nam|tàu|tây)"), category: "hate", score: 0.45 },
  { pattern: word("tự tử|kết liễu|end my life"), category: "self-harm", score: 0.74 },
  { pattern: word("vé lậu|vé chợ đen|scalp|phe vé"), category: "illicit", score: 0.55 },
];

/**
 * Unicode-aware word boundary. `\b` is ASCII-only, so it silently fails to match Vietnamese terms that
 * start or end with a non-ASCII letter ("đm", "tự tử", "phe vé") — exactly the terms these rules need.
 */
function word(alternatives: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, "iu");
}

/** Baseline noise so a completely benign post still carries plausible non-zero scores. */
const BASELINE_CATEGORIES = ["harassment", "hate", "sexual", "violence", "self-harm", "illicit"] as const;

@Injectable()
export class FakeSafetyProvider implements SafetyProvider {
  readonly name = "fake";
  readonly model = "fake-moderation-v1";

  async moderate(input: { text: string }, _ctx: AnalysisContext): Promise<SafetyProviderResult> {
    const seed = seedFrom("safety", input.text);
    const categoryScores: Record<string, number> = {};

    for (const [index, category] of BASELINE_CATEGORIES.entries()) {
      categoryScores[category] = round2(seededFloat(seed, index + 1, 0, 0.2));
    }
    for (const rule of RULES) {
      if (rule.pattern.test(input.text))
        categoryScores[rule.category] = Math.max(categoryScores[rule.category] ?? 0, rule.score);
    }

    const categories = Object.fromEntries(Object.entries(categoryScores).map(([k, v]) => [k, v >= 0.5]));
    return {
      flagged: Object.values(categories).some(Boolean),
      categoryScores,
      categories,
      raw: { provider: this.name, model: this.model },
    };
  }
}
