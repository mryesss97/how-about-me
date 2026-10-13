"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canAccess } from "@/features/auth/route-roles";
import { useRole } from "@/features/auth/use-role";
import { cx } from "@/utils/cx";

const tabs = [
  { href: "/settings/project", label: "Project" },
  { href: "/settings/members", label: "Members" },
  { href: "/settings/integrations", label: "Integrations" },
  { href: "/settings/analysis", label: "Analysis" },
];

/** Settings tabs filtered by role (FR-018, TC-AUTH-014). UX only — the server enforces. */
export function SettingsTabs() {
  const { role } = useRole();
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className="mt-4 flex gap-2 border-b border-secondary">
      {tabs
        .filter((t) => canAccess(t.href, role))
        .map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "-mb-px border-b-2 px-3 py-2 text-sm font-semibold",
                active ? "border-brand text-brand-secondary" : "border-transparent text-tertiary hover:text-primary",
              )}
            >
              {t.label}
            </Link>
          );
        })}
    </nav>
  );
}
