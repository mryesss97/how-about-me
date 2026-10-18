/** #330: the one secondary card action. DESIGN.md Operate Surfaces "Plaque button". ≥ 44 px under md (#386). */
import { forwardRef, type ButtonHTMLAttributes, type FC, type ReactNode } from "react";
import Link from "next/link";

type PlaqueSize = "xs" | "sm" | "md";

const SIZE: Record<PlaqueSize, string> = {
  xs: "gap-1.5 px-2 py-1 text-xs",
  sm: "gap-2 px-3 py-1.5",
  md: "gap-2 px-4 py-2.5",
};

const BASE =
  "plaque-button inline-flex items-center max-md:min-h-11 outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Plaque classes for a React Aria trigger (DialogTrigger / Slideout trigger need an `AriaButton`, not a native
 * button). Same look as PlaqueButton; use only where a React Aria pressable is required.
 */
export function plaqueClassName(size: PlaqueSize = "sm", extra = ""): string {
  return [BASE, SIZE[size], extra].filter(Boolean).join(" ");
}

type IconType = FC<{ className?: string; "aria-hidden"?: boolean | "true" }>;

export type PlaqueButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> & {
  size?: PlaqueSize;
  iconLeading?: IconType;
  iconTrailing?: IconType;
  isLoading?: boolean;
  isDisabled?: boolean;
  /** 404 actions: full width on mobile, auto from `sm`. */
  fullWidthOnMobile?: boolean;
  /** Render as a `next/link` instead of a button. */
  href?: string;
  children?: ReactNode;
};

function Spinner({ className }: { className: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle className="stroke-current opacity-30" cx="10" cy="10" r="8" fill="none" strokeWidth="2" />
      <circle
        className="origin-center stroke-current"
        cx="10"
        cy="10"
        r="8"
        fill="none"
        strokeWidth="2"
        strokeDasharray="12.5 50"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const PlaqueButton = forwardRef<HTMLButtonElement, PlaqueButtonProps>(function PlaqueButton(
  {
    size = "sm",
    iconLeading: Leading,
    iconTrailing: Trailing,
    isLoading = false,
    isDisabled = false,
    fullWidthOnMobile = false,
    href,
    className,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  const iconClass = size === "md" ? "size-5 shrink-0" : "size-4 shrink-0";
  const classes = [BASE, SIZE[size], fullWidthOnMobile ? "w-full justify-center sm:w-auto" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  // Label stays in place while loading so the accessible name never changes (#330); state via aria-busy.
  const content = (
    <>
      {isLoading ? <Spinner className={iconClass} /> : Leading ? <Leading className={iconClass} aria-hidden /> : null}
      {children}
      {Trailing ? <Trailing className={iconClass} aria-hidden /> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} aria-label={rest["aria-label"]}>
        {content}
      </Link>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={isDisabled || isLoading}
      aria-busy={isLoading ? true : undefined}
      {...rest}
    >
      {content}
    </button>
  );
});
