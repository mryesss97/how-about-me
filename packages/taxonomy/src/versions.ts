/** Version strings persisted on every analysis run (BR-023). Bump per docs/01-product/08-taxonomy-classification.md §10. */
export const TAXONOMY_VERSION = "taxonomy-v1" as const;
export const SAFETY_POLICY_VERSION = "safety-policy-v1" as const;
export const DEFAULT_PROMPT_VERSION = "classifier-v2" as const;
export const METRICS_VERSION = "metrics-v1" as const;

/** `safety-policy-v{n}` — per-project analysis policy version (FR-190, BR-018, BR-023). */
export function safetyPolicyVersionOf(n: number): string {
  return `safety-policy-v${n}`;
}

/** Inverse of `safetyPolicyVersionOf`; null when the string is not a policy version. */
export function parseSafetyPolicyVersion(s: string): number | null {
  const m = /^safety-policy-v([1-9]\d*)$/.exec(s);
  return m ? Number(m[1]) : null;
}
