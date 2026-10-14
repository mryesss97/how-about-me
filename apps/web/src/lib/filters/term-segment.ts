import { TermFilterSchema } from "@how-about-me/contracts";

/**
 * `/terms/[term]` route segment → normalised term (#276), or null when invalid (→ not found). The segment arrives
 * percent-encoded or decoded depending on the caller; normalised like the API (BR-041).
 */
export function parseTermSegment(raw: string): string | null {
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    // Already decoded and containing a bare "%".
  }
  const parsed = TermFilterSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
