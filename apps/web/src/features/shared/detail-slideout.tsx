"use client";

import { ChevronLeft, ChevronRight, Expand06 } from "@untitledui/icons";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Button } from "@/components/base/buttons/button";

/** #339: one-after-another navigation in the slide-out (Reviews). */
export type DetailSlideoutNav = {
  /** Position text, e.g. "3 / 25" or "3 / 25+". */
  label: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
  isLoadingNext?: boolean;
};

const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]';

/** J/K only for plain keys whose target sits inside this slide-out's dialog and is not a text field (#339). */
function navKeyTarget(e: KeyboardEvent, dialog: Element | null | undefined): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || !dialog) return false;
  const t = e.target;
  if (!(t instanceof Element) || !dialog.contains(t)) return false;
  return !t.closest(TYPING);
}

/**
 * Slide-out frame shared by Mentions (`?item=`, UX §3.4, TC-MEN-009, #326) and Reviews (#219, #233).
 * Esc / close → back to the list with its filters; React Aria returns focus to the element that opened it.
 */
export function DetailSlideout({
  title,
  regionLabel,
  fullPageHref,
  fallbackHref,
  onClose,
  actions,
  nav,
  subheader,
  footer,
  itemKey,
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
  /** #339: ‹ n / N › + J/K. */
  nav?: DetailSlideoutNav;
  /** #339: line under the title (e.g. review reasons). */
  subheader?: ReactNode;
  /** #339: sticky footer for the primary action, visible at every size. */
  footer?: ReactNode;
  /** #339: changes when the shown item changes without remounting the frame → focus moves to the title. */
  itemKey?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [open, setOpen] = useState(true);
  const qs = search?.toString() ?? "";
  const titleRef = useRef<HTMLHeadingElement>(null);
  const navRef = useRef(nav);
  useEffect(() => {
    navRef.current = nav;
  });
  const hasNav = nav !== undefined;

  // J = next, K = prev (#339). DOM containment, not React bubbling: the override dialog is a portal on top.
  useEffect(() => {
    if (!hasNav) return;
    const onKey = (e: KeyboardEvent) => {
      const n = navRef.current;
      if (!n || !navKeyTarget(e, titleRef.current?.closest('[role="dialog"]'))) return;
      const k = e.key.toLowerCase();
      if (k === "j" && !n.nextDisabled) {
        e.preventDefault();
        n.onNext();
      } else if (k === "k" && !n.prevDisabled) {
        e.preventDefault();
        n.onPrev();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hasNav]);

  // Focus the new item's heading when the item changes in place (not on first mount: React Aria focuses the dialog).
  const prevKey = useRef(itemKey);
  useEffect(() => {
    if (prevKey.current !== itemKey) titleRef.current?.focus();
    prevKey.current = itemKey;
  }, [itemKey]);

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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pr-8">
          <h2
            ref={titleRef}
            tabIndex={-1}
            className="min-w-0 flex-1 truncate text-lg font-semibold text-primary outline-none md:flex-none"
          >
            {title}
          </h2>
          {/* Soft navigation to the full page (#326). #339: icon-only 44px button below md, one Link. */}
          <Link
            href={fullPageHref(qs)}
            className="inline-flex size-11 shrink-0 items-center justify-center gap-1 text-sm font-semibold text-[var(--ink)] underline-offset-2 hover:underline md:size-auto"
          >
            <Expand06 className="size-5 md:size-4" aria-hidden />
            <span className="sr-only md:not-sr-only">Mở trang đầy đủ</span>
          </Link>
          {nav ? (
            <div className="flex w-full items-center gap-1 md:ml-auto md:w-auto">
              <Button
                color="tertiary"
                size="sm"
                aria-label="Mục trước"
                iconLeading={ChevronLeft}
                className="min-h-11 min-w-11 md:min-h-0 md:min-w-0"
                isDisabled={nav.prevDisabled}
                onClick={nav.onPrev}
              />
              <span aria-live="polite" className="px-1 text-sm text-secondary tabular-nums">
                {nav.label}
              </span>
              <Button
                color="tertiary"
                size="sm"
                aria-label="Mục sau"
                iconLeading={ChevronRight}
                className="min-h-11 min-w-11 md:min-h-0 md:min-w-0"
                isDisabled={nav.nextDisabled}
                isLoading={nav.isLoadingNext}
                onClick={nav.onNext}
              />
            </div>
          ) : null}
          {actions ? <div className="ml-auto">{actions}</div> : null}
        </div>
        {nav ? <p className="mt-1 hidden text-xs text-tertiary md:block">J/K: chuyển mục · Esc: đóng</p> : null}
        {subheader ? <div className="mt-2">{subheader}</div> : null}
      </SlideoutMenu.Header>
      <SlideoutMenu.Content role="region" aria-label={regionLabel} className="pb-6">
        {children}
      </SlideoutMenu.Content>
      {footer ? <SlideoutMenu.Footer>{footer}</SlideoutMenu.Footer> : null}
    </SlideoutMenu>
  );
}
