"use client";

import Link from "next/link";
import { canAccess } from "@/features/auth/route-roles";
import { useRole } from "@/features/auth/use-role";

const tabs = [
  { href: "/settings/project", label: "Project" },
  { href: "/settings/members", label: "Members" },
  { href: "/settings/integrations", label: "Integrations" },
];

/** Settings tabs filtered by role (FR-018, TC-AUTH-014). UX only — the server enforces. */
export function SettingsTabs() {
  const { role } = useRole();
  return (
    <nav aria-label="Settings sections" className="mt-4 flex gap-2 border-b border-secondary">
      {tabs
        .filter((t) => canAccess(t.href, role))
        .map((t) => (
          <Link key={t.href} href={t.href} className="px-3 py-2 text-sm font-semibold text-tertiary hover:text-primary">
            {t.label}
          </Link>
        ))}
    </nav>
  );
}
