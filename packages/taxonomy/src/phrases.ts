/**
 * Key phrase normalisation (BR-041, FR-120) — docs/01-product/08-taxonomy-classification.md "Key phrases".
 * Phrases are free text, not taxonomy labels: no accent stripping, no synonym merging ("gia ve" ≠ "giá vé").
 */
export const MAX_PHRASES_PER_POST = 5;
export const PHRASE_MAX_LENGTH = 60;

/** Prompt versions whose output carries `keyPhrases` (classifier output schema v2). */
export const PHRASE_PROMPT_VERSIONS = ["classifier-v2", "fake-v2"] as const;

const EDGE_PUNCT = /^["'“”‘’.!?:()[\]#]+|["'“”‘’.!?:()[\]#]+$/gu;

/**
 * BR-041: NFC → lowercase (vi) → `, ; |` and newlines become spaces (phrases never contain the CSV separator)
 * → strip quotes/punctuation at both ends (inner `-` and `/` kept, e.g. "check-in") → collapse whitespace.
 * Returns null when empty, without any letter/digit, or longer than `PHRASE_MAX_LENGTH`.
 */
export function normalizePhrase(raw: string): string | null {
  let s = raw.normalize("NFC").toLocaleLowerCase("vi");
  s = s.replace(/[,;|\r\n]+/g, " ");
  // Trim first so edge punctuation behind whitespace is reached, then trim again.
  s = s.replace(/\s+/g, " ").trim().replace(EDGE_PUNCT, "").replace(/\s+/g, " ").trim();
  if (s === "" || !/[\p{L}\p{N}]/u.test(s) || s.length > PHRASE_MAX_LENGTH) return null;
  return s;
}

/** BR-041: normalise, drop invalid, dedupe keeping first occurrence, cap at `MAX_PHRASES_PER_POST`. */
export function normalizePhrases(list: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    const p = normalizePhrase(raw);
    if (p !== null && !out.includes(p)) out.push(p);
    if (out.length === MAX_PHRASES_PER_POST) break;
  }
  return out;
}
