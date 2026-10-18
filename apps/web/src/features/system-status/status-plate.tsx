import { cx } from "@/utils/cx";
import type { Tone } from "./format";

export const TONE_DOT: Record<Tone, string> = {
  success: "bg-fg-success-secondary",
  warning: "bg-fg-warning-secondary",
  error: "bg-fg-error-secondary",
  progress: "bg-fg-brand-secondary",
  neutral: "bg-fg-quaternary",
};

/** Dot + text status plate; the label carries the meaning, the colour only reinforces it (BR-017). */
export function StatusPlate({ label, tone, className }: { label: string; tone: Tone; className?: string }) {
  return (
    <span
      data-tone={tone}
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-secondary bg-primary px-2 py-0.5 text-xs font-semibold text-secondary",
        className,
      )}
    >
      <span aria-hidden className={cx("size-2 rounded-full", TONE_DOT[tone])} />
      {label}
    </span>
  );
}
