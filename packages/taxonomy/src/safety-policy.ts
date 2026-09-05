import { SAFETY_POLICY_VERSION } from "./versions.js";
import type { SafetyLevel } from "./labels.js";

/**
 * Safety policy v1 — product mapping over moderation provider categories (BR-018).
 * Thresholds per docs/01-product/08-taxonomy-classification.md §9. `null` = not applicable for that level.
 */
export type SafetyThreshold = { sensitive: number | null; severe: number | null };

export const SAFETY_POLICY_V1: Readonly<Record<string, SafetyThreshold>> = {
  harassment: { sensitive: 0.5, severe: null },
  "harassment/threatening": { sensitive: 0.3, severe: 0.7 },
  hate: { sensitive: 0.4, severe: 0.8 },
  "hate/threatening": { sensitive: 0.3, severe: 0.6 },
  sexual: { sensitive: 0.5, severe: null },
  "sexual/minors": { sensitive: null, severe: 0.3 },
  violence: { sensitive: 0.5, severe: 0.85 },
  "violence/graphic": { sensitive: 0.4, severe: 0.8 },
  "self-harm": { sensitive: 0.3, severe: 0.7 },
  "self-harm/intent": { sensitive: null, severe: 0.4 },
  "self-harm/instructions": { sensitive: null, severe: 0.4 },
  illicit: { sensitive: 0.5, severe: null },
  "illicit/violent": { sensitive: 0.4, severe: 0.7 },
};

export type SafetyPolicyInput = { categoryScores: Record<string, number>; flagged: boolean };
export type SafetyPolicyResult = {
  level: SafetyLevel;
  policyVersion: string;
  triggered: { category: string; score: number; level: "sensitive" | "severe" }[];
};

/**
 * Maps provider scores to `safe | sensitive | severe`.
 * severe if any severe threshold crossed; else sensitive if any sensitive threshold crossed or provider flagged; else safe.
 * Sentiment is never an input (BR-017).
 */
export function mapSafetyLevel(
  input: SafetyPolicyInput,
  policy: Readonly<Record<string, SafetyThreshold>> = SAFETY_POLICY_V1,
  policyVersion: string = SAFETY_POLICY_VERSION,
): SafetyPolicyResult {
  const triggered: SafetyPolicyResult["triggered"] = [];
  for (const [category, score] of Object.entries(input.categoryScores)) {
    const t = policy[category];
    if (!t || typeof score !== "number" || Number.isNaN(score)) continue;
    if (t.severe != null && score >= t.severe) triggered.push({ category, score, level: "severe" });
    else if (t.sensitive != null && score >= t.sensitive) triggered.push({ category, score, level: "sensitive" });
  }
  let level: SafetyLevel = "safe";
  if (triggered.some((x) => x.level === "severe")) level = "severe";
  else if (triggered.length > 0 || input.flagged) level = "sensitive";
  return { level, policyVersion, triggered };
}
