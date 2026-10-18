"use client";

import { TermDetailView } from "@/features/analytics/term-detail-view";
import { TermMentions } from "@/features/mentions/term-mentions";

/** #333: composes the phrase page — mentions board right under the hero, with the hero's sentiment counts. */
export function TermPage({ term }: { term: string }) {
  return (
    <TermDetailView
      term={term}
      renderList={({ counts, total }) => <TermMentions term={term} counts={counts} total={total} />}
    />
  );
}
