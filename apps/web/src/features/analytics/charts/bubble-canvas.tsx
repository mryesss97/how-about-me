"use client";

import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useResizeObserver } from "@/hooks/use-resize-observer";
import {
  BUBBLE_FACE_CLASS,
  BubbleLabel,
  BubbleShell,
  bubbleAriaLabel,
  bubbleFaceStyle,
} from "@/features/shared/bubbles/bubble-3d";
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
    </div>
  );
}
