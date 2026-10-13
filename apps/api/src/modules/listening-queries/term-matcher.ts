/**
 * Include/exclude term evaluation for a post ↔ listening query match.
 *
 * BR-007: terms are applied *after* ingestion (the post is always stored), case-insensitively,
 * Unicode NFC-normalised, as a substring match on the post text. Exclusion wins over inclusion.
 * A post excluded for a query is not counted for that query (FR-059, FR-060); a post excluded by
 * every query that matched it is not analysed at all —
 * docs/02-architecture/06-ingestion-pipeline.md §6.
 */

export type ExclusionReason = "exclude_term" | "no_include_term_matched";

export type TermEvaluation = {
  /** Value for `post_query_matches.excluded_by_terms`. */
  excluded: boolean;
  reason: ExclusionReason | null;
  /** The exclude term that decided it — shown in the mention detail drawer so "why is this hidden?" is answerable. */
  matchedExcludeTerm: string | null;
  /** Include terms found in the text; feeds `ClassifierInput.matchedTerms` later (T-072). */
  matchedIncludeTerms: string[];
};

/**
 * NFC first, then lower-case, then NFC again — lower-casing can re-decompose some characters, and
 * Vietnamese text arrives in both compositions ("MÚI GIỜ" typed on iOS vs Android).
 * Diacritics are deliberately kept: "mui gio" must NOT match the term "múi giờ".
 */
export function normalizeForMatch(value: string): string {
  return value.normalize("NFC").toLowerCase().normalize("NFC");
}

/**
 * `evaluateTerms(text, includeTerms, excludeTerms)` — pure, no DB, no config.
 *
 * - any exclude term present → excluded (`exclude_term`)
 * - include terms configured and none present → excluded (`no_include_term_matched`)
 * - no terms configured → kept
 *
 * Blank terms are ignored so a stray `[""]` in the DB cannot exclude an entire query's traffic.
 */
export function evaluateTerms(
  text: string | null | undefined,
  includeTerms: readonly string[] = [],
  excludeTerms: readonly string[] = [],
): TermEvaluation {
  const haystack = normalizeForMatch(text ?? "");
  const excludes = usableTerms(excludeTerms);
  const includes = usableTerms(includeTerms);

  const matchedExcludeTerm = excludes.find((t) => haystack.includes(t.normalized))?.original ?? null;
  if (matchedExcludeTerm !== null)
    return { excluded: true, reason: "exclude_term", matchedExcludeTerm, matchedIncludeTerms: [] };

  const matchedIncludeTerms = includes.filter((t) => haystack.includes(t.normalized)).map((t) => t.original);
  if (includes.length > 0 && matchedIncludeTerms.length === 0)
    return { excluded: true, reason: "no_include_term_matched", matchedExcludeTerm: null, matchedIncludeTerms: [] };

  return { excluded: false, reason: null, matchedExcludeTerm: null, matchedIncludeTerms };
}

/** Convenience wrapper for the ingestion transaction, which only needs the flag. */
export function isExcludedByTerms(
  text: string | null | undefined,
  includeTerms: readonly string[] = [],
  excludeTerms: readonly string[] = [],
): boolean {
  return evaluateTerms(text, includeTerms, excludeTerms).excluded;
}

function usableTerms(terms: readonly string[]): { original: string; normalized: string }[] {
  return terms
    .map((t) => ({ original: t, normalized: normalizeForMatch(t.trim()) }))
    .filter((t) => t.normalized.length > 0);
}
