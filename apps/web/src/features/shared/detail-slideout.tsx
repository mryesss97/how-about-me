"use client";

import { Expand06 } from "@untitledui/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";

/**
 * Slide-out frame shared by Mentions (intercepting route, UX §3.4, TC-MEN-009) and Reviews (#219, #233).
 * Esc / close → back to the list with its filters; React Aria returns focus to the element that opened it.
 */
export function DetailSlideout({
  title,
  regionLabel,
  fullPageHref,
  fallbackHref,
  onClose,
  actions,
  children,
}: {
  title: string;
  regionLabel: string;
  /** Builds the "Open full page" href from the current query string. */
  fullPageHref: (qs: string) => string;
  /** Close target when there is no history entry to go back to (query string appended). */
  fallbackHref: string;
  /** Overrides the default close (history back → `fallbackHref`), e.g. Reviews clears `?item` (#219). */
  onClose?: () => void;
  /** Extra controls rendered in the header (e.g. "Mark reviewed"). */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [open, setOpen] = useState(true);
  const qs = search?.toString() ?? "";

  const close = useCallback(() => {
    setOpen(false);
    if (onClose) return onClose();
    // Opened from the list → history has the list entry. Deep links render the full page, not this slide-out.
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(`${fallbackHref}${qs ? `?${qs}` : ""}`);
  }, [router, qs, onClose, fallbackHref]);

  return (
    <SlideoutMenu
      isOpen={open}
      onOpenChange={(o) => !o && close()}
      isDismissable
      // SlideoutMenu puts `className` on both the overlay and the panel, so widen the panel via the
      // overlay's child selector; a plain max-w here would shrink the full-screen overlay too.
      className="z-50 md:*:max-w-3xl"
      dialogClassName="gap-4"
    >
      <SlideoutMenu.Header onClose={close}>
        <div className="flex items-center gap-3 pr-8">
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          {/* Plain <a> on purpose: a full navigation escapes the intercepting route and renders the page. */}
          <a
            href={fullPageHref(qs)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-secondary hover:underline"
          >
            <Expand06 className="size-4" aria-hidden />
            Mở trang đầy đủ
          </a>
          {actions ? <div className="ml-auto">{actions}</div> : null}
        </div>
      </SlideoutMenu.Header>
      <SlideoutMenu.Content role="region" aria-label={regionLabel} className="pb-6">
        {children}
      </SlideoutMenu.Content>
    </SlideoutMenu>
  );
}
