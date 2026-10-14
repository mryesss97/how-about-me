import { forwardRef } from "react";
import { SENTIMENT_COLORS } from "@/features/shared/bubbles/sentiment-style";
import { cx } from "@/utils/cx";
import { landingCopy as copy } from "./copy";
import type { GrowthDirection, LandingGrowth, LandingStat } from "./landing-data";

type Props = { stats: LandingStat[] | null; loading: boolean };

const GROWTH_STYLE: Record<GrowthDirection, { arrow: string; cls: string }> = {
  up: { arrow: "↑ ", cls: "bg-utility-green-50 text-utility-green-700 ring-utility-green-200" },
  down: { arrow: "↓ ", cls: "bg-utility-red-50 text-utility-red-700 ring-utility-red-200" },
  flat: { arrow: "", cls: "bg-utility-neutral-50 text-utility-neutral-700 ring-utility-neutral-200" },
  new: { arrow: "", cls: "bg-utility-neutral-50 text-utility-neutral-700 ring-utility-neutral-200" },
};

const DOT: Partial<Record<LandingStat["key"], string>> = {
  positive: SENTIMENT_COLORS.positive,
  negative: SENTIMENT_COLORS.negative,
};

/** Growth pill (#267): capped text on screen, exact value for screen readers. */
function GrowthBadge({ g }: { g: LandingGrowth }) {
  const s = GROWTH_STYLE[g.direction];
  return (
    <span
      aria-label={g.aria}
      className={cx("rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset", s.cls)}
    >
      {s.arrow}
      {g.text}
    </span>
  );
}

/** Hairlines: desktop between columns; mobile 2×2 with a column line and a row line (#267). */
const itemCls = (i: number) =>
  cx(
    "flex flex-col gap-1 border-secondary px-6",
    i % 2 === 1 && "border-l",
    i === 2 && "sm:border-l",
    i >= 2 && "border-t pt-4 sm:border-t-0 sm:pt-0",
  );

/** Frameless 4-stat row (#262, #267): Mentions (+growth), Positive %, Negative %, Updated. Never safety (BR-017). */
export const LandingStats = forwardRef<HTMLDivElement, Props>(function LandingStats({ stats, loading }, ref) {
  if (!loading && !stats) return null; // error → hidden; hero and Explore stay usable
  return (
    <div ref={ref} className="relative z-10 flex w-full max-w-3xl flex-col gap-4 px-4">
      <dl aria-label={copy.statsLabel} aria-busy={loading || undefined} className="grid grid-cols-2 sm:grid-cols-4">
        {loading || !stats
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} data-testid="landing-stat-skeleton" className={itemCls(i)}>
                <div className="h-4 w-16 animate-pulse rounded-md bg-secondary" />
                <div className="h-8 w-20 animate-pulse rounded-md bg-secondary" />
              </div>
            ))
          : stats.map((s, i) => (
              <div key={s.key} className={itemCls(i)}>
                <dt className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-quaternary uppercase">
                  {DOT[s.key] ? (
                    <span aria-hidden className="size-1.5 rounded-full" style={{ background: DOT[s.key] }} />
                  ) : null}
                  {s.label}
                </dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <span className="text-xl font-semibold whitespace-nowrap text-primary tabular-nums sm:text-display-xs">
                    {s.value}
                  </span>
                  {s.growth ? <GrowthBadge g={s.growth} /> : null}
                </dd>
              </div>
            ))}
      </dl>
      <p className="text-center text-xs text-balance text-quaternary">{copy.legend}</p>
    </div>
  );
});
