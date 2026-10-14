"use client";

import { useMemo } from "react";
import { BUBBLE_FACE_CLASS, BubbleLabel, BubbleShell, bubbleFaceStyle } from "@/features/shared/bubbles/bubble-3d";
import { landingCopy as copy } from "./copy";
import { type LandingBubble, balloonLabel } from "./landing-data";
import { type Rect, layoutLandingBalloons, MOBILE_MAX_BALLOONS } from "./landing-layout";

type Props = {
  bubbles: readonly LandingBubble[];
  size: { width: number; height: number };
  exclude: readonly Rect[];
  mobile: boolean;
  reducedMotion: boolean;
};

/**
 * Landing balloons (#262, FR-149): decorative-but-informative, no drill-down — each balloon is a focusable
 * `role="img"` with the full text as its name and a hover/focus tooltip; there is no click action.
 */
export function LandingBalloons({ bubbles, size, exclude, mobile, reducedMotion }: Props) {
  const positions = useMemo(
    () =>
      new Map(
        layoutLandingBalloons(bubbles, {
          ...size,
          exclude,
          maxCount: mobile ? MOBILE_MAX_BALLOONS : undefined,
          maxR: mobile ? Math.min(size.width, size.height) * 0.16 : undefined,
        }).map((p) => [p.key, p]),
      ),
    [bubbles, size, exclude, mobile],
  );

  return (
    <div
      role="group"
      aria-label={copy.balloonsLabel}
      data-motion={reducedMotion ? "reduced" : "full"}
      data-entering="false"
      className="bubble-map absolute inset-0"
    >
      {bubbles.map((b, i) => {
        const p = positions.get(b.key) ?? null;
        if (!p) return null;
        const label = balloonLabel(b);
        return (
          <BubbleShell key={b.key} pos={p} index={i}>
            <div
              role="img"
              tabIndex={0}
              aria-label={label}
              data-empty={b.empty ? "true" : undefined}
              className={BUBBLE_FACE_CLASS}
              style={bubbleFaceStyle(b, i)}
            >
              {b.empty ? (
                <span aria-hidden className="max-w-full truncate px-1 text-xs font-semibold text-tertiary">
                  {b.name}
                </span>
              ) : (
                <BubbleLabel d={b} r={p.r} tipBelow={p.y - p.r < 40} tooltip={label} alwaysTip />
              )}
            </div>
          </BubbleShell>
        );
      })}
    </div>
  );
}
