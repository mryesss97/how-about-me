import { forwardRef } from "react";
import { BrandLogo } from "@/features/shared/brand-logo";

/** Landing top bar (#267): horizontal logo top-left; its rect is excluded from the orb layout. */
export const LandingTopBar = forwardRef<HTMLDivElement>(function LandingTopBar(_props, ref) {
  return (
    <div ref={ref} data-testid="landing-top-bar" className="absolute top-6 left-6 z-10">
      <BrandLogo variant="horizontal" className="h-auto w-[140px]" />
    </div>
  );
});
