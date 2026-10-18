"use client";

import { TermDetailView } from "@/features/analytics/term-detail-view";
import { TermMentions } from "@/features/mentions/term-mentions";
import { HealthStrip } from "@/features/shared/health-strip";

/** #333: composes the phrase page — mentions board right under the hero, with the hero's sentiment counts. */
export function TermPage({ term }: { term: string }) {
  return (
    <TermDetailView
      term={term}
      renderList={({ counts, total }) => (
        <>
          {/* #345: no PageHeader here, so the strip sits under the hero. */}
          <HealthStrip />
          <TermMentions term={term} counts={counts} total={total} />
        </>
      )}
    />
  );
}
