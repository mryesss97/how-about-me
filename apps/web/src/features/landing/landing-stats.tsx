import { forwardRef } from "react";
import { landingCopy as copy } from "./copy";
import type { LandingStat } from "./landing-data";

type Props = { stats: LandingStat[] | null; loading: boolean };

/** 4-stat strip (#262): Mentions (+growth), Positive %, Negative %, Last updated. Never safety (BR-017). */
export const LandingStats = forwardRef<HTMLDivElement, Props>(function LandingStats({ stats, loading }, ref) {
  if (!loading && !stats) return null; // error → hidden; hero and Explore stay usable
  return (
    <div ref={ref} className="relative z-10 w-full max-w-3xl px-4">
      <dl
        aria-label={copy.statsLabel}
        aria-busy={loading || undefined}
        className="grid grid-cols-2 gap-3 rounded-2xl bg-primary/90 p-4 shadow-sm ring-1 ring-secondary sm:grid-cols-4"
      >
        {loading || !stats
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} data-testid="landing-stat-skeleton" className="flex flex-col gap-2">
                <div className="h-4 w-16 animate-pulse rounded-md bg-secondary" />
                <div className="h-6 w-20 animate-pulse rounded-md bg-secondary" />
              </div>
            ))
          : stats.map((s) => (
              <div key={s.key} className="flex flex-col gap-1">
                <dt className="text-sm text-tertiary">{s.label}</dt>
                <dd className="flex items-baseline gap-2">
                  <span className="text-xl font-semibold text-primary tabular-nums">{s.value}</span>
                  {s.hint ? <span className="text-sm font-medium text-tertiary tabular-nums">{s.hint}</span> : null}
                </dd>
              </div>
            ))}
      </dl>
    </div>
  );
});
