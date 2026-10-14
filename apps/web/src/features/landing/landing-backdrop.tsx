import { orbitRings } from "./landing-geometry";
import type { Rect } from "./landing-layout";

type Props = {
  size: { width: number; height: number };
  content: Rect | null;
  mobile: boolean;
  /** Empty state (#267): N dashed ghost circles spread over the rings. */
  ghosts?: number;
};

const GHOST_R = 28;

/** Landing canvas (#267): faint grid, two colour washes and the orbit rings the orbs sit on. Decorative only. */
export function LandingBackdrop({ size, content, mobile, ghosts = 0 }: Props) {
  const { cx, cy, rings } = orbitRings(size.width, size.height, mobile, content);
  const measured = size.width > 0 && size.height > 0;
  const outer = rings[rings.length - 1];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="landing-grid absolute inset-0" />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 40% 35% at ${measured ? `${cx}px ${cy}px` : "50% 50%"}, color-mix(in oklab, var(--color-brand-200) 60%, transparent), transparent 70%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 35% 30% at 100% 100%, color-mix(in oklab, var(--color-utility-pink-500) 10%, transparent), transparent 70%)",
        }}
      />
      {measured ? (
        <svg className="absolute inset-0 size-full" width={size.width} height={size.height}>
          {rings.map((ring, i) => (
            <ellipse
              key={i}
              cx={cx}
              cy={cy}
              rx={ring.rx}
              ry={ring.ry}
              fill="none"
              stroke="color-mix(in oklab, var(--color-utility-sky-500) 12%, transparent)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              strokeDasharray={ring.dashed ? "4 6" : undefined}
            />
          ))}
          {outer
            ? Array.from({ length: ghosts }).map((_, i) => {
                const a = -Math.PI / 2 + (2 * Math.PI * i) / ghosts;
                return (
                  <circle
                    key={`g${i}`}
                    data-testid="landing-ghost"
                    cx={cx + outer.rx * Math.cos(a)}
                    cy={cy + outer.ry * Math.sin(a)}
                    r={GHOST_R}
                    fill="none"
                    stroke="var(--color-utility-neutral-400)"
                    strokeOpacity={0.6}
                    strokeDasharray="3 4"
                  />
                );
              })
            : null}
        </svg>
      ) : null}
    </div>
  );
}
