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

/** Brand v2 logo: the primary (Ink wordmark) file only — the app is light only (#260). */
export function BrandLogo({ variant = "horizontal", className }: BrandLogoProps) {
  const { file, width, height } = VARIANTS[variant];
  return (
    <span className="inline-flex shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
      <img src={`/brand/${file}-primary.svg`} alt="How About Me" width={width} height={height} className={className} />
    </span>
  );
}
