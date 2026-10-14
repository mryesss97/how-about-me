"use client";

import type { CSSProperties } from "react";
import type { BubblePosition } from "@/features/shared/bubbles/bubble-layout";
import { bubbleIntensity } from "@/features/shared/bubbles/bubble-layout";
import { SENTIMENT_COLORS } from "@/features/shared/bubbles/sentiment-style";
import { cx } from "@/utils/cx";
import { type LandingBubble, balloonLabel } from "./landing-data";

/** Shade-700 share text (copied from the sentiment map so `.bubble-3d` code stays untouched); never safety (BR-017). */
const SHARE_TEXT: Record<LandingBubble["dominant"], string> = {
  positive: "text-utility-green-700",
  neutral: "text-utility-neutral-700",
  negative: "text-utility-red-700",
};

/** Radius (px) from which the "● 62%" share line shows on the face (#267). */
export const ORB_SHARE_R = 30;

const nameSize = (r: number) => (r >= 72 ? "text-md" : r >= 44 ? "text-sm" : "text-xs");

/** Intensity k ∈ [0.6, 1] from the dominant share, so stronger majorities glow more (#267). */
function orbStyle(b: LandingBubble, i: number): CSSProperties {
  const t = (bubbleIntensity(b.dominantShare) - 0.1) / 0.3;
  return {
    ["--orb-hue" as string]: SENTIMENT_COLORS[b.dominant],
    ["--orb-k" as string]: (0.6 + 0.4 * Math.min(Math.max(t, 0), 1)).toFixed(2),
    ["--orb-i" as string]: String(i),
  };
}

/**
 * One landing orb (#267, FR-149): position layer (translate) → drift layer (keyframes) → face (entry + hover scale),
 * so the transforms never fight. The face is a focusable `role="img"` with the full text as name and tooltip; the
 * face itself shows only the term + "● 62%" (sentiment word lives in the aria-label/tooltip, BR-017 colour + text).
 */
export function LandingOrb({ b, pos, index }: { b: LandingBubble; pos: BubblePosition; index: number }) {
  const { r } = pos;
  const label = balloonLabel(b);
  return (
    <div
      className="landing-pos absolute top-0 left-0"
      style={{ width: 2 * r, height: 2 * r, transform: `translate(${pos.x - r}px, ${pos.y - r}px)` }}
    >
      <div
        className="landing-drift size-full"
        style={{
          ["--orb-dur" as string]: `${9 + ((index * 7) % 6)}s`,
          ["--orb-phase" as string]: `-${(index * 1.3).toFixed(1)}s`,
        }}
      >
        <div
          role="img"
          tabIndex={0}
          aria-label={label}
          data-empty={b.empty ? "true" : undefined}
          className="landing-orb group/orb flex size-full flex-col items-center justify-center px-2 text-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          style={orbStyle(b, index)}
        >
          <span aria-hidden className="flex flex-col items-center leading-tight" style={{ maxWidth: r * 1.6 }}>
            <span className={cx("max-w-full truncate font-semibold text-primary", nameSize(r))}>{b.name}</span>
            {!b.empty && r >= ORB_SHARE_R ? (
              <span
                className={cx("flex items-center gap-1 text-xs font-semibold tabular-nums", SHARE_TEXT[b.dominant])}
              >
                <span className="size-1.5 rounded-full" style={{ background: SENTIMENT_COLORS[b.dominant] }} />
                {`${Math.round(b.dominantShare * 100)}%`}
              </span>
            ) : null}
          </span>
          <span
            aria-hidden
            className={cx(
              "pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-md bg-primary-solid px-2 py-1 text-xs font-semibold whitespace-nowrap text-white opacity-0 group-hover/orb:opacity-100 group-focus-visible/orb:opacity-100",
              pos.y - r < 40 ? "top-full mt-1" : "bottom-full mb-1",
            )}
          >
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
