import { createHash } from "node:crypto";

/**
 * Seeded helpers shared by the fake AI providers (T-013): the same text always yields the same labels,
 * scores and token counts, so fixtures, snapshots and the analytics QA checklist stay reproducible
 * across machines and runs — docs/02-architecture/02-backend-design.md §10.
 */

/** Stable 32-bit seed derived from the content (not `Math.random`, not the clock). */
export function seedFrom(...parts: string[]): number {
  return createHash("sha256").update(parts.join("|"), "utf8").digest().readUInt32BE(0);
}

/** Deterministic value in `[min, max)` for `seed`, varied by `salt` so independent fields do not correlate. */
export function seededFloat(seed: number, salt: number, min: number, max: number): number {
  // xorshift32 — tiny, dependency-free, good enough for demo data.
  let x = (seed ^ (salt * 0x9e3779b9)) >>> 0 || 1;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >> 17;
  x ^= x << 5;
  x >>>= 0;
  return min + (x / 0x1_0000_0000) * (max - min);
}

export function seededPick<T>(seed: number, salt: number, items: readonly T[]): T {
  const index = Math.floor(seededFloat(seed, salt, 0, items.length));
  return items[Math.min(index, items.length - 1)] as T;
}

/** Rounds to two decimals so stored confidences read like a real provider's output. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Vietnamese diacritics are the cheapest reliable signal for the demo language field. */
export function detectLanguage(text: string): "vi" | "en" | "unknown" {
  if (text.trim().length === 0) return "unknown";
  if (/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(text)) return "vi";
  return "en";
}

/** Rough token estimate (~4 chars/token) — enough for cost simulation and budget-pause tests. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
  prices: { inputPer1M: number; outputPer1M: number },
): number {
  const cost = (inputTokens / 1_000_000) * prices.inputPer1M + (outputTokens / 1_000_000) * prices.outputPer1M;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
