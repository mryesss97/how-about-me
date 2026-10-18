import { cx } from "@/utils/cx";

export type Tone = "success" | "warning" | "error" | "progress" | "neutral";

export const TONE_DOT: Record<Tone, string> = {
  success: "bg-fg-success-secondary",
  warning: "bg-fg-warning-secondary",
  error: "bg-fg-error-secondary",
  progress: "bg-fg-brand-secondary",
  neutral: "bg-fg-quaternary",
};

/**
 * Enamel status plate (#342, DESIGN.md §Operate Surfaces): success = green enamel, error = red enamel, others ink
 * on white with a navy keyline. Dot + text; the label carries the meaning, colour only reinforces it (BR-017).
 */
export function StatusPlate({ label, tone, className }: { label: string; tone: Tone; className?: string }) {
  return (
    <span data-tone={tone} className={cx("status-plate", className)}>
      <span aria-hidden className={cx("status-plate-dot size-2 rounded-full", TONE_DOT[tone])} />
      {label}
    </span>
  );
}
