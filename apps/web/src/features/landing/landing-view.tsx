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
import { landingCopy as copy } from "./copy";
import { BlankBoard, SignBoard } from "./landing-board";
import { boardRanks, fallbackRange, formatLandingStats, toLandingBoards } from "./landing-data";
import { MainSign } from "./landing-main-sign";
import { type Rect, WALL_GAP, layoutSignWall, phoneWallHeight } from "./sign-wall-layout";

const NO_PARAMS: Record<string, string> = {};
/** Blank boards hung while phrases load, fail, or none is configured (#271). */
const PLACEHOLDERS = Array.from({ length: 8 }, (_, i) => ({ key: `blank-${i}`, total: 8 - i }));

/**
 * Full-screen landing `/` (#262, #271): a Saigon signboard wall. Every configured phrase (FR-149, BR-042) hangs as an
 * enamel board sized by mentions around the main sign (headline, 30-day figures, door plaque into the dashboard).
 * Desktop and tablet fill one viewport; phones stack the main sign above a scrolling wall. Light only (#260).
 */
export function LandingView() {
  const { project } = useCurrentProject();
  const projectId = project?.id ?? null;
  const { hasRole } = useRole();
  const reducedMotion = usePrefersReducedMotion();
  const wide = useBreakpoint("sm");

  const landing = useLandingTerms(projectId);
  // Figures use the landing range so both agree; fall back to 30 days in the project tz if landing-terms failed.
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

  const boards = useMemo(() => (landing.data ? toLandingBoards(landing.data.rows) : []), [landing.data]);
  const ranks = useMemo(() => boardRanks(boards), [boards]);
  const empty = landing.isSuccess && boards.length === 0;
  const items = useMemo(
    () => (boards.length > 0 ? boards.map((b) => ({ key: b.key, total: b.total })) : PLACEHOLDERS),
    [boards],
  );

  const wallRef = useRef<HTMLDivElement>(null);
  const signRef = useRef<HTMLElement>(null);
  const [wall, setWall] = useState({ width: 0, height: 0 });
  const [hole, setHole] = useState<Rect | null>(null);
  const measure = useCallback(() => {
    const el = wallRef.current;
    if (!el) return;
    setWall({ width: el.clientWidth, height: el.clientHeight });
    const sign = signRef.current;
    if (!wide || !sign) {
      setHole(null);
      return;
    }
    const o = el.getBoundingClientRect();
    const r = sign.getBoundingClientRect();
    setHole(r.width > 0 ? { x: r.left - o.left, y: r.top - o.top, width: r.width, height: r.height } : null);
  }, [wide]);
  useResizeObserver({ ref: wallRef, onResize: measure });
  useEffect(measure, [measure, stats, statsLoading, empty, items.length]);

  const rects = useMemo(
    () => layoutSignWall(items, { width: wall.width, height: wall.height, hole, gap: WALL_GAP }),
    [items, wall.width, wall.height, hole],
  );
  const byKey = useMemo(() => new Map(boards.map((b) => [b.key, b])), [boards]);

  return (
    <main
      data-motion={reducedMotion ? "reduced" : "full"}
      className="sign-wall relative min-h-dvh overflow-x-hidden sm:h-dvh sm:overflow-hidden"
    >
      {/* Same DOM at every width (SSR-safe); CSS moves the main sign into the wall from `sm` up. */}
      <div className="p-1.5 sm:p-0">
        <MainSign
          ref={signRef}
          stats={stats}
          loading={statsLoading}
          empty={empty ? (hasRole(["admin"]) ? "admin" : "other") : null}
          className="relative sm:absolute sm:top-[47%] sm:left-1/2 sm:z-10 sm:w-[clamp(400px,62vw,560px)] sm:-translate-x-1/2 sm:-translate-y-1/2 lg:w-[clamp(520px,44vw,680px)]"
        />
      </div>
      <div
        ref={wallRef}
        role="group"
        aria-label={copy.wallLabel}
        className="relative mx-[3px] mb-[3px] h-[var(--phone-wall-h)] sm:absolute sm:inset-[3px] sm:m-0 sm:h-auto"
        style={{ ["--phone-wall-h" as string]: `${phoneWallHeight(items.length)}px` }}
      >
        {rects.map((rect, i) => {
          const board = byKey.get(rect.key);
          return board ? (
            <SignBoard key={rect.key} board={board} rect={rect} rank={ranks.get(rect.key) ?? i + 1} index={i} />
          ) : (
            <BlankBoard key={rect.key} rect={rect} index={i} />
          );
        })}
      </div>
    </main>
  );
}
