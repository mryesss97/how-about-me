"use client";

import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useResizeObserver } from "@/hooks/use-resize-observer";
import {
  BUBBLE_FACE_CLASS,
  BubbleLabel,
  BubbleShell,
  LABEL_COMPACT_R,
  bubbleAriaLabel,
  bubbleFaceStyle,
} from "@/features/shared/bubbles/bubble-3d";
import { SentimentIcon } from "@/features/shared/bubbles/sentiment-icon";
import { bubbleCopy } from "@/features/shared/bubbles/sentiment-style";
import { cx } from "@/utils/cx";
import { bubbleMapCopy as copy } from "../copy";
import { type BubbleDatum, layoutBubbles } from "./bubble-layout";

export { bubbleAriaLabel, LABEL_COMPACT_R, LABEL_FULL_R } from "@/features/shared/bubbles/bubble-3d";

type Props = {
  all: readonly BubbleDatum[];
  visible: ReadonlySet<string>;
  selected: string | null;
  onSelect: (key: string | null) => void;
  reducedMotion: boolean;
  /** #389: heading of the row listing bubbles too small for in-bubble text. */
  smallLabel?: string;
  /** Centred over the bubble area only (e.g. the filtered-empty message), not over the small-topics row. */
  overlay?: ReactNode;
};

/**
 * Bubble canvas (#222): every bubble stays mounted (filtered ones fade/scale out, inert) so re-layout and exit
 * animate via CSS. Three layers: position (translate) → float (keyframes) → button (3D style, hover/selected).
 */
export function BubbleCanvas({
  all,
  visible,
  selected,
  onSelect,
  reducedMotion,
  smallLabel = copy.smallLabel,
  overlay,
}: Props) {
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

  // #389 (BR-017): bubbles below the compact radius have no in-bubble text, so they are listed as plates.
  const small = useMemo(
    () => shown.filter((d) => (positions.get(d.key)?.r ?? 0) < LABEL_COMPACT_R),
    [shown, positions],
  );

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onSelect(null);
  };

  return (
    <div className="flex flex-col gap-2">
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
          const p = positions.get(d.key) ?? null;
          const r = p?.r ?? 0;
          return (
            <BubbleShell key={d.key} pos={p} index={i}>
              <button
                type="button"
                tabIndex={p ? 0 : -1}
                aria-label={bubbleAriaLabel(d)}
                aria-pressed={selected === d.key}
                onClick={() => onSelect(selected === d.key ? null : d.key)}
                className={cx(BUBBLE_FACE_CLASS, "cursor-pointer")}
                style={bubbleFaceStyle(d, i)}
              >
                <BubbleLabel d={d} r={r} tipBelow={(p?.y ?? 0) - r < 40} />
              </button>
            </BubbleShell>
          );
        })}
        {overlay}
      </div>
      {small.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-tertiary" onKeyDown={onKeyDown}>
          <span>{smallLabel}</span>
          {small.map((d) => (
            <button
              key={d.key}
              type="button"
              aria-pressed={selected === d.key}
              onClick={() => onSelect(selected === d.key ? null : d.key)}
              className="task-plate inline-flex min-h-11 cursor-pointer items-center gap-1 !text-xs normal-case hover:bg-[var(--ink)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring aria-pressed:bg-[var(--ink)] aria-pressed:text-white sm:min-h-8"
            >
              <SentimentIcon sentiment={d.dominant} className="size-3.5" />
              {bubbleCopy.smallItem(d.name, d.dominantShare, d.dominant, d.total)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
