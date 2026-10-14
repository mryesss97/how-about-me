import { forwardRef } from "react";
import { Button } from "@/components/base/buttons/button";
import { BrandLogo } from "@/features/shared/brand-logo";
import { landingCopy as copy } from "./copy";

/** Hero (#262): logo, headline, tagline and the Explore CTA → `/overview` (current project kept in localStorage). */
export const LandingHero = forwardRef<HTMLDivElement>(function LandingHero(_props, ref) {
  return (
    <div ref={ref} className="relative z-10 flex w-full max-w-md flex-col items-center gap-4 px-4 text-center">
      <BrandLogo variant="stacked" className="h-auto w-[160px] sm:w-[200px]" />
      <h1 className="text-display-xs font-semibold text-primary sm:text-display-sm">{copy.headline}</h1>
      <p className="text-lg text-tertiary">{copy.tagline}</p>
      <Button href="/overview" size="xl" className="w-full sm:w-auto">
        {copy.explore}
      </Button>
    </div>
  );
});
