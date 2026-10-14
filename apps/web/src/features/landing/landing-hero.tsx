import { ArrowRight } from "@untitledui/icons";
import { forwardRef } from "react";
import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";
import { landingCopy as copy } from "./copy";

/** Splits a headline line around the accent word so it can be tinted brand (#267). */
function Accent({ line }: { line: string }) {
  const at = line.indexOf(copy.headlineAccent);
  if (at < 0) return <>{line}</>;
  return (
    <>
      {line.slice(0, at)}
      <span className="text-brand-600">{copy.headlineAccent}</span>
      {line.slice(at + copy.headlineAccent.length)}
    </>
  );
}

/**
 * Hero (#262, #267): eyebrow pill, 2-line headline, tagline and the Explore CTA → `/overview`. `live` (a sync has
 * happened) controls the pulsing green dot and the "Live" word; otherwise the dot is grey and still.
 */
export const LandingHero = forwardRef<HTMLDivElement, { live: boolean }>(function LandingHero({ live }, ref) {
  const eyebrow = [...(live ? [copy.eyebrow.live] : []), copy.eyebrow.source, copy.eyebrow.range].join(" · ");
  return (
    <div ref={ref} className="relative z-10 flex w-full max-w-[640px] flex-col items-center gap-5 px-4 text-center">
      <span className="inline-flex items-center gap-2 rounded-full bg-primary/70 px-3 py-1 text-xs font-medium text-secondary ring-1 ring-secondary backdrop-blur">
        <span
          aria-hidden
          data-testid="landing-eyebrow-dot"
          className={cx(
            "size-1.5 rounded-full",
            live
              ? "landing-pulse animate-[landing-pulse_2s_ease-in-out_infinite] bg-utility-green-500 motion-reduce:animate-none"
              : "bg-utility-neutral-400",
          )}
        />
        {eyebrow}
      </span>
      <h1 className="text-display-sm font-semibold tracking-[-0.02em] text-primary sm:text-display-md">
        {copy.headlineLines.map((line) => (
          <span key={line} className="block">
            <Accent line={line} />
          </span>
        ))}
      </h1>
      <p className="text-lg text-tertiary">{copy.tagline}</p>
      <Button
        href="/overview"
        size="xl"
        iconTrailing={ArrowRight}
        className="w-full rounded-full shadow-[0_8px_24px_-8px_var(--color-brand-500)] sm:w-auto"
      >
        {copy.explore}
      </Button>
    </div>
  );
});
