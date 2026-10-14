"use client";

import { useMemo } from "react";
import { landingCopy as copy } from "./copy";
import type { LandingBubble } from "./landing-data";
import { type Rect, layoutLandingBalloons, MOBILE_MAX_BALLOONS } from "./landing-layout";
import { LandingOrb } from "./landing-orb";

type Props = {
  bubbles: readonly LandingBubble[];
  size: { width: number; height: number };
  exclude: readonly Rect[];
  content: Rect | null;
  mobile: boolean;
  reducedMotion: boolean;
};

/**
 * Landing orbs (#262, #267, FR-149): decorative-but-informative, no drill-down — each orb is a focusable
 * `role="img"` with the full text as its name and a hover/focus tooltip; there is no click action.
 */
export function LandingBalloons({ bubbles, size, exclude, content, mobile, reducedMotion }: Props) {
  const positions = useMemo(
    () =>
      new Map(
        layoutLandingBalloons(bubbles, {
          ...size,
          exclude,
          content,
          mobile,
          maxCount: mobile ? MOBILE_MAX_BALLOONS : undefined,
          maxR: mobile ? Math.min(size.width, size.height) * 0.16 : undefined,
        }).map((p) => [p.key, p]),
      ),
    [bubbles, size, exclude, content, mobile],
  );

  return (
    <div
      role="group"
      aria-label={copy.balloonsLabel}
      data-motion={reducedMotion ? "reduced" : "full"}
      className="landing-orbs absolute inset-0"
    >
      {bubbles.map((b, i) => {
        const p = positions.get(b.key);
        return p ? <LandingOrb key={b.key} b={b} pos={p} index={i} /> : null;
      })}
    </div>
  );
}
