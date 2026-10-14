import { ArrowDown, ArrowRight, ArrowUp } from "@untitledui/icons";
import Link from "next/link";
import { forwardRef } from "react";
import { BrandLogo } from "@/features/shared/brand-logo";
import { cx } from "@/utils/cx";
import { landingCopy as copy } from "./copy";
import type { LandingStat } from "./landing-data";

type Props = {
  stats: LandingStat[] | null;
  loading: boolean;
  /** No phrase configured: admins get a link to Settings, other roles a neutral line. */
  empty: "admin" | "other" | null;
  className?: string;
};

/**
 * The shop's main sign (#271): sky enamel with the logo plate, the Vietnamese headline, the 30-day figures painted
 * as the sign's info line, and the door-plaque link into the dashboard. Safety is never shown (BR-017).
 */
export const MainSign = forwardRef<HTMLElement, Props>(function MainSign({ stats, loading, empty, className }, ref) {
  return (
    <section ref={ref} aria-labelledby="landing-headline" className={cx("main-sign", className)}>
      <span aria-hidden className="sign-keyline" />
      <div className="relative flex flex-col gap-5 p-6 sm:p-8">
        <span className="main-sign-logo self-start">
          <BrandLogo className="h-auto w-[132px] sm:w-[156px]" />
        </span>
        <div className="flex flex-col gap-3">
          <h1 id="landing-headline" className="main-sign-headline">
            {copy.headline}
          </h1>
          <p className="text-md font-medium text-white sm:text-lg">{copy.tagline}</p>
        </div>

        {stats || loading ? (
          <dl aria-label={copy.statsLabel} aria-busy={loading || undefined} className="main-sign-figures">
            {(stats ?? PLACEHOLDER).map((s) => (
              <div key={s.key} className="flex min-w-0 flex-col gap-0.5">
                <dt className="order-2 text-xs font-medium text-white sm:text-sm">{s.label}</dt>
                <dd className="order-1 flex flex-wrap items-baseline gap-x-2">
                  {s.status ? (
                    <span className="main-sign-status">{s.value}</span>
                  ) : (
                    <span className={cx("main-sign-figure", loading && "opacity-40")}>{loading ? "—" : s.value}</span>
                  )}
                  {s.growth ? (
                    <span aria-label={s.growth.aria} className="main-sign-growth">
                      {s.growth.direction === "up" ? <ArrowUp aria-hidden className="size-4" /> : null}
                      {s.growth.direction === "down" ? <ArrowDown aria-hidden className="size-4" /> : null}
                      {s.growth.text}
                    </span>
                  ) : null}
                </dd>
                {s.note ? <dd className="order-3 text-xs text-white">{s.note}</dd> : null}
              </div>
            ))}
          </dl>
        ) : null}

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/overview" className="door-plaque">
            <span>{copy.explore}</span>
            <ArrowRight aria-hidden className="size-5" />
          </Link>
          {empty === "admin" ? (
            <Link href="/settings/project" className="text-sm font-semibold text-white underline underline-offset-4">
              {copy.emptyAdmin}
            </Link>
          ) : empty === "other" ? (
            <p className="text-sm text-white">{copy.emptyOther}</p>
          ) : (
            <p className="max-w-[34ch] text-xs text-white sm:text-sm">{copy.legend}</p>
          )}
        </div>
      </div>
    </section>
  );
});

const PLACEHOLDER: LandingStat[] = (["mentions", "positive", "negative", "lastUpdated"] as const).map((key) => ({
  key,
  value: "—",
  label: copy.stats[key],
  growth: null,
}));
