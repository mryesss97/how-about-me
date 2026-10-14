/** Orbit-ring geometry shared by the landing backdrop (SVG) and the orb layout (#267) — pure, unit-testable. */

export type OrbitRing = { rx: number; ry: number; dashed: boolean };
export type OrbitRings = { cx: number; cy: number; rings: OrbitRing[] };

/** Fallback ring sizes (share of the half-canvas) while the hero/stats block is unmeasured. */
const DESKTOP_FACTORS = [0.42, 0.62, 0.82] as const;
const MOBILE_FACTORS = [0.62, 0.82] as const;
/** Where each ring sits between the content block's edge (0) and the canvas edge inset (1). */
const DESKTOP_STEPS = [0.22, 0.6, 1] as const;
const MOBILE_STEPS = [0.45, 1] as const;
/** Gap between the content block and the innermost ring, and inset of the outermost ring from the canvas edge. */
const CONTENT_PAD = 28;
export const EDGE_INSET = 56;

type Box = { x: number; y: number; width: number; height: number };

/**
 * Concentric ellipses centred on the hero + stats block (`content`), or on the canvas while it is unmeasured.
 * Rings are spread from just outside the block to `EDGE_INSET` from the nearest canvas edge, so orbs fill the free
 * space evenly above, below and beside the content instead of crowding one side (#267). The outermost ring is dashed.
 */
export function orbitRings(width: number, height: number, mobile: boolean, content?: Box | null): OrbitRings {
  if (!content || content.width <= 0 || content.height <= 0) {
    const factors = mobile ? MOBILE_FACTORS : DESKTOP_FACTORS;
    return {
      cx: width / 2,
      cy: height / 2,
      rings: factors.map((f, i) => ({ rx: (f * width) / 2, ry: (f * height) / 2, dashed: i === factors.length - 1 })),
    };
  }
  const cx = content.x + content.width / 2;
  const cy = content.y + content.height / 2;
  const inner = { rx: content.width / 2 + CONTENT_PAD, ry: content.height / 2 + CONTENT_PAD };
  const edge = {
    rx: Math.max(Math.min(cx, width - cx) - EDGE_INSET, inner.rx * 1.12),
    ry: Math.max(Math.min(cy, height - cy) - EDGE_INSET, inner.ry * 1.12),
  };
  const steps = mobile ? MOBILE_STEPS : DESKTOP_STEPS;
  return {
    cx,
    cy,
    rings: steps.map((t, i) => ({
      rx: inner.rx + t * (edge.rx - inner.rx),
      ry: inner.ry + t * (edge.ry - inner.ry),
      dashed: i === steps.length - 1,
    })),
  };
}
