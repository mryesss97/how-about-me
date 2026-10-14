import { cx } from "@/utils/cx";

/**
 * Official brand v2 state illustrations in `public/brand/illustrations` (#245). Page-level states only;
 * card/widget states keep the compact FeaturedIcon (UX §2.3).
 */
export type StateIllustrationName = "empty" | "pending" | "sync-attention";

/**
 * Decorative: the adjacent heading carries the meaning, so the image is hidden from assistive tech.
 * Light file only — the app is light only (#260).
 */
export function StateIllustration({ name, className }: { name: StateIllustrationName; className?: string }) {
  return (
    <span className="inline-flex w-full shrink-0 justify-center" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
      <img
        src={`/brand/illustrations/${name}.svg`}
        alt=""
        width={360}
        height={240}
        className={cx("h-auto w-full max-w-[240px] sm:max-w-[280px]", className)}
      />
    </span>
  );
}
