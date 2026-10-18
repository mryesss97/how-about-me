"use client";

import type { CSSProperties, ReactNode } from "react";
import { formatRate } from "@/lib/format/number";
import { cx } from "@/utils/cx";
import { type BubbleDatum, bubbleIntensity } from "./bubble-layout";
import { SentimentIcon } from "./sentiment-icon";
import { SENTIMENT_COLORS, bubbleCopy } from "./sentiment-style";

/** Shade-700 text tokens for the "% sentiment" line (prototype); sentiment hues only, never safety (BR-017). */
const SHARE_TEXT: Record<BubbleDatum["dominant"], string> = {
  positive: "text-utility-green-700",
  neutral: "text-utility-neutral-700",
  negative: "text-utility-red-700",
};

export const bubbleAriaLabel = (d: BubbleDatum) =>
  `${d.name}, ${bubbleCopy.shareLine(d.dominantShare, d.dominant)}, ${bubbleCopy.mentions(d.total)}`;

/**
 * Radius thresholds (px) for in-bubble labels (UX §3.2, #389). Below `compact` the bubble has no in-bubble text;
 * the canvas lists it in the "small topics" row instead (BR-017: colour is never the only cue).
 */
export const LABEL_FULL_R = 58;
export const LABEL_WORD_R = 44;
export const LABEL_COMPACT_R = 36;

export const BUBBLE_FACE_CLASS =
  "bubble-3d group/bubble flex size-full flex-col items-center justify-center px-2 text-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/** CSS variables driving the `.bubble-3d` style (globals.css). `empty` bubbles (#262, 0 mentions) render grey. */
export function bubbleFaceStyle(d: BubbleDatum, index: number): CSSProperties {
  return {
    ["--bubble-hue" as string]: SENTIMENT_COLORS[d.dominant],
    ["--bubble-mix" as string]: `${Math.round(bubbleIntensity(d.dominantShare) * 100)}%`,
    ["--bubble-delay" as string]: `${index * 60}ms`,
  };
}

type PositionProps = {
  /** Circle centre and radius in px; null keeps the bubble mounted but hidden (exit animation). */
  pos: { x: number; y: number; r: number } | null;
  index: number;
  children: ReactNode;
};

/** Position layer (translate) → float layer (keyframes); the face (button or div) is the child (#222, #262). */
export function BubbleShell({ pos, index, children }: PositionProps) {
  const hidden = !pos;
  const r = pos?.r ?? 0;
  return (
    <div
      className={cx("bubble-pos absolute top-0 left-0", hidden && "pointer-events-none opacity-0")}
      style={{
        width: 2 * r,
        height: 2 * r,
        transform: pos ? `translate(${pos.x - r}px, ${pos.y - r}px)` : "translate(50%, 50%) scale(0)",
      }}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
    >
      <div className="bubble-float size-full" style={{ ["--bubble-phase" as string]: `-${index * 0.9}s` }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Label by radius (#389, BR-017 — sentiment always has a word or icon, never colour only): ≥ 58 px name +
 * "75.0% negative" + "N mentions"; 44–58 px name + "75.0% negative"; 36–44 px name + sentiment icon + "75.0%";
 * smaller → tooltip on hover/focus (the aria-label always carries the full text). Text is clamped to the bubble's inner width.
 * `tooltip` overrides the hover text (landing uses "term · 62% positive · 128 mentions").
 */
export function BubbleLabel({
  d,
  r,
  tipBelow,
  tooltip,
  alwaysTip = false,
}: {
  d: BubbleDatum;
  r: number;
  tipBelow: boolean;
  tooltip?: string;
  alwaysTip?: boolean;
}) {
  const shareCls = cx("max-w-full truncate text-xs font-semibold tabular-nums", SHARE_TEXT[d.dominant]);
  const tip = (
    <span
      aria-hidden
      className={cx(
        "pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-md bg-primary-solid px-2 py-1 text-xs font-semibold whitespace-nowrap text-white opacity-0 group-hover/bubble:opacity-100 group-focus-visible/bubble:opacity-100",
        tipBelow ? "top-full mt-1" : "bottom-full mb-1",
      )}
    >
      {tooltip ?? bubbleAriaLabel(d)}
    </span>
  );
  if (r >= LABEL_FULL_R) {
    return (
      <>
        <span aria-hidden className="flex flex-col items-center leading-tight" style={{ maxWidth: r * 1.6 }}>
          <span className={cx("max-w-full truncate font-semibold text-primary", r >= 80 ? "text-md" : "text-sm")}>
            {d.name}
          </span>
          <span className={shareCls}>{bubbleCopy.shareLine(d.dominantShare, d.dominant)}</span>
          <span className="max-w-full truncate text-xs text-tertiary">{bubbleCopy.mentions(d.total)}</span>
        </span>
        {alwaysTip ? tip : null}
      </>
    );
  }
  return (
    <>
      {r >= LABEL_COMPACT_R ? (
        <span aria-hidden className="flex flex-col items-center leading-tight" style={{ maxWidth: r * 1.6 }}>
          <span className="max-w-full truncate text-xs font-semibold text-primary">{d.name}</span>
          {r >= LABEL_WORD_R ? (
            <span className={cx(shareCls, "text-[11px]")}>{bubbleCopy.shareLine(d.dominantShare, d.dominant)}</span>
          ) : (
            <span className={cx(shareCls, "inline-flex items-center gap-0.5")}>
              <SentimentIcon sentiment={d.dominant} className="size-3.5" />
              {formatRate(d.dominantShare)}
            </span>
          )}
        </span>
      ) : null}
      {tip}
    </>
  );
}
