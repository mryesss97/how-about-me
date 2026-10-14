import { cx } from "@/utils/cx";

/** Official brand v2 logo files in `public/brand` (#221). Width/height follow each SVG viewBox. */
const VARIANTS = {
  horizontal: { file: "logo-horizontal", width: 380, height: 80 },
  stacked: { file: "logo-stacked", width: 320, height: 190 },
  mark: { file: "mark", width: 64, height: 64 },
} as const;

export type BrandLogoVariant = keyof typeof VARIANTS;

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
}

/**
 * Brand v2 logo. Renders the primary (Ink wordmark) file in light mode and the white file
 * in dark mode (`.dark-mode`, next-themes); only one image is exposed to assistive tech.
 */
export function BrandLogo({ variant = "horizontal", className }: BrandLogoProps) {
  const { file, width, height } = VARIANTS[variant];
  return (
    <span className="inline-flex shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
      <img
        src={`/brand/${file}-primary.svg`}
        alt="How About Me"
        width={width}
        height={height}
        className={cx("block dark:hidden", className)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
      <img
        src={`/brand/${file}-white.svg`}
        alt=""
        aria-hidden="true"
        width={width}
        height={height}
        className={cx("hidden dark:block", className)}
      />
    </span>
  );
}
