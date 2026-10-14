"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { useRole } from "@/features/auth/use-role";
import { useLandingTerms } from "@/features/shared/use-landing-terms";
import { useOverview } from "@/features/shared/use-overview";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useResizeObserver } from "@/hooks/use-resize-observer";
import { env } from "@/lib/env";
import { LandingBalloons } from "./landing-balloons";
import { fallbackRange, formatLandingStats, toLandingBubbles } from "./landing-data";
import { LandingEmpty } from "./landing-empty";
import { LandingHero } from "./landing-hero";
import type { Rect } from "./landing-layout";
import { LandingStats } from "./landing-stats";

const NO_PARAMS: Record<string, string> = {};

const toRect = (el: HTMLElement | null, origin: DOMRect): Rect | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { x: r.left - origin.left, y: r.top - origin.top, width: r.width, height: r.height };
};

/**
 * Full-screen landing `/` (#262): balloons per landing term (FR-149, BR-042), hero + Explore, 4 stats from the
 * overview over the same 30-day range. Light mode only (#260); no sidebar/header.
 */
export function LandingView() {
  const { project } = useCurrentProject();
  const projectId = project?.id ?? null;
  const { hasRole } = useRole();
  const reducedMotion = usePrefersReducedMotion();
  const desktop = useBreakpoint("sm");

  const landing = useLandingTerms(projectId);
  // Stats use the landing range so both agree; fall back to 30 days in the project tz if landing-terms failed.
  const [now] = useState(() => new Date());
  const range = useMemo(
    () =>
      landing.data?.range ??
      (landing.isError ? fallbackRange(now, project?.timezone ?? env.NEXT_PUBLIC_DEFAULT_TIMEZONE) : null),
    [landing.data, landing.isError, now, project?.timezone],
  );
  const overviewParams = useMemo<Record<string, string>>(
    () => (range ? { compare: "true", from: range.from, timezone: range.timezone, to: range.to } : NO_PARAMS),
    [range],
  );
  const overview = useOverview(range ? projectId : null, overviewParams);
  const stats = useMemo(() => (overview.data ? formatLandingStats(overview.data, now) : null), [overview.data, now]);
  const statsLoading = !overview.isError && !overview.data;

  const bubbles = useMemo(() => (landing.data ? toLandingBubbles(landing.data.rows) : []), [landing.data]);
  const empty = landing.isSuccess && bubbles.length === 0;

  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [exclude, setExclude] = useState<Rect[]>([]);
  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const origin = root.getBoundingClientRect();
    setSize({ width: root.clientWidth, height: root.clientHeight });
    setExclude([toRect(heroRef.current, origin), toRect(statsRef.current, origin)].filter((r): r is Rect => !!r));
  }, []);
  useResizeObserver({ ref: rootRef, onResize: measure });
  useEffect(measure, [measure, stats, statsLoading, empty]);

  return (
    <main
      ref={rootRef}
      className="relative flex min-h-dvh flex-col items-center justify-center gap-8 overflow-x-hidden bg-secondary py-8 sm:h-dvh sm:overflow-hidden"
    >
      {bubbles.length > 0 ? (
        <LandingBalloons
          bubbles={bubbles}
          size={size}
          exclude={exclude}
          mobile={!desktop}
          reducedMotion={reducedMotion}
        />
      ) : null}
      <LandingHero ref={heroRef} />
      {empty ? <LandingEmpty admin={hasRole(["admin"])} /> : null}
      <LandingStats ref={statsRef} stats={stats} loading={statsLoading} />
    </main>
  );
}
