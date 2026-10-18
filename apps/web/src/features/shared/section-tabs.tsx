"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { cx } from "@/utils/cx";
import { plaqueClassName } from "./plaque-button";

export type SectionTabItem = { href: string; label: string; current: boolean };

/**
 * #386 (N4): shared route-section tabs (Settings, System Status). Links + aria-current, not an ARIA tablist (#348).
 * ≥ 44 px at every size; 2×2 grid under `sm` when there are ≥ 3 tabs, a wrapping row otherwise.
 */
export function SectionTabs({
  ariaLabel,
  items,
  onNavigate,
  scroll,
}: {
  ariaLabel: string;
  items: SectionTabItem[];
  onNavigate?: (href: string, e: MouseEvent<HTMLAnchorElement>) => void;
  scroll?: boolean;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cx(items.length >= 3 ? "grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" : "flex flex-wrap gap-2")}
    >
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          scroll={scroll}
          aria-current={t.current ? "page" : undefined}
          className={plaqueClassName("sm", "min-h-11 justify-center text-center")}
          onClick={onNavigate ? (e) => onNavigate(t.href, e) : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
