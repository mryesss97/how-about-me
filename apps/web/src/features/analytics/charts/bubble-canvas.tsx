"use client";

import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useResizeObserver } from "@/hooks/use-resize-observer";
import { formatRate } from "@/lib/format/number";
import { cx } from "@/utils/cx";
import { bubbleMapCopy as copy } from "../copy";
import { type BubbleDatum, bubbleIntensity, layoutBubbles } from "./bubble-layout";
import { SENTIMENT_COLORS } from "./chart-data";

/** Shade-700 text tokens for the "% sentiment" line (prototype); sentiment hues only, never safety (BR-017). */
const SHARE_TEXT: Record<BubbleDatum["dominant"], string> = {
  positive: "text-utility-green-700",
  neutral: "text-utility-neutral-700",
  negative: "text-utility-red-700",
};

export const bubbleAriaLabel = (d: BubbleDatum) =>
  `${d.name}, ${copy.shareLine(d.dominantShare, d.dominant)}, ${copy.mentions(d.total)}`;

type Props = {
  all: readonly BubbleDatum[];
  visible: ReadonlySet<string>;
  selected: string | null;
  onSelect: (key: string | null) => void;
  reducedMotion: boolean;
};

/**
 * Bubble canvas (#222): every bubble stays mounted (filtered ones fade/scale out, inert) so re-layout and exit
 * animate via CSS. Three layers: position (translate) → float (keyframes) → button (3D style, hover/selected).
 */
export function BubbleCanvas({ all, visible, selected, onSelect, reducedMotion }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const measure = useCallback(() => {
    const el = ref.current;
    if (el) setSize({ width: el.clientWidth, height: el.clientHeight });
  }, []);
  useResizeObserver({ ref, onResize: measure });
  useEffect(measure, [measure]);

  // Grow-in stagger only on first mount; cleared afterwards so hover/selected transforms apply.
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setEntering(false), 500 + all.length * 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first mount only
  }, []);

  const shown = useMemo(() => all.filter((d) => visible.has(d.key)), [all, visible]);
  const positions = useMemo(() => new Map(layoutBubbles(shown, size).map((p) => [p.key, p])), [shown, size]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onSelect(null);
  };

  return (
    <div
      ref={ref}
      role="group"
      aria-label={copy.canvasLabel}
      onKeyDown={onKeyDown}
      data-motion={reducedMotion ? "reduced" : "full"}
      data-entering={entering ? "true" : "false"}
      className="bubble-map relative h-[360px] w-full overflow-hidden md:h-[480px] xl:h-[560px]"
    >
      {all.map((d, i) => {
        const p = positions.get(d.key);
        const hidden = !p;
        const r = p?.r ?? 0;
        return (
          <div
            key={d.key}
            className={cx("bubble-pos absolute top-0 left-0", hidden && "pointer-events-none opacity-0")}
            style={{
              width: 2 * r,
              height: 2 * r,
              transform: p ? `translate(${p.x - r}px, ${p.y - r}px)` : "translate(50%, 50%) scale(0)",
            }}
            aria-hidden={hidden || undefined}
            inert={hidden || undefined}
          >
            <div className="bubble-float size-full" style={{ ["--bubble-phase" as string]: `-${i * 0.9}s` }}>
              <button
                type="button"
                tabIndex={hidden ? -1 : 0}
                aria-label={bubbleAriaLabel(d)}
                aria-pressed={selected === d.key}
                onClick={() => onSelect(selected === d.key ? null : d.key)}
                className="bubble-3d group/bubble flex size-full cursor-pointer flex-col items-center justify-center px-2 text-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                style={{
                  ["--bubble-hue" as string]: SENTIMENT_COLORS[d.dominant],
                  ["--bubble-mix" as string]: `${Math.round(bubbleIntensity(d.dominantShare) * 100)}%`,
                  ["--bubble-delay" as string]: `${i * 60}ms`,
                }}
              >
                <BubbleLabel d={d} r={r} tipBelow={(p?.y ?? 0) - r < 40} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Radius thresholds (px) for in-bubble labels; below `compact` only the hover/focus tooltip shows (UX §3.2). */
export const LABEL_FULL_R = 58;
export const LABEL_COMPACT_R = 36;

/**
 * Label by radius: ≥ 58 px topic + "75.0% negative" + "N mentions"; 36–58 px topic + "75.0%"; smaller → tooltip
 * on hover/focus (the aria-label always carries the full text). Text is clamped to the bubble's inner width.
 */
function BubbleLabel({ d, r, tipBelow }: { d: BubbleDatum; r: number; tipBelow: boolean }) {
  const shareCls = cx("max-w-full truncate text-xs font-semibold tabular-nums", SHARE_TEXT[d.dominant]);
  if (r >= LABEL_FULL_R) {
    return (
      <span aria-hidden className="flex flex-col items-center leading-tight" style={{ maxWidth: r * 1.6 }}>
        <span className={cx("max-w-full truncate font-semibold text-primary", r >= 80 ? "text-md" : "text-sm")}>
          {d.name}
        </span>
        <span className={shareCls}>{copy.shareLine(d.dominantShare, d.dominant)}</span>
        <span className="max-w-full truncate text-xs text-tertiary">{copy.mentions(d.total)}</span>
      </span>
    );
  }
  return (
    <>
      {r >= LABEL_COMPACT_R ? (
        <span aria-hidden className="flex flex-col items-center leading-tight" style={{ maxWidth: r * 1.6 }}>
          <span className="max-w-full truncate text-xs font-semibold text-primary">{d.name}</span>
          <span className={shareCls}>{formatRate(d.dominantShare)}</span>
        </span>
      ) : null}
      <span
        aria-hidden
        className={cx(
          "pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-md bg-primary-solid px-2 py-1 text-xs font-semibold whitespace-nowrap text-white opacity-0 group-hover/bubble:opacity-100 group-focus-visible/bubble:opacity-100",
          tipBelow ? "top-full mt-1" : "bottom-full mb-1",
        )}
      >
        {bubbleAriaLabel(d)}
      </span>
    </>
  );
}
