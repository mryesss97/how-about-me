"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canAccess } from "@/features/auth/route-roles";
import { useRole } from "@/features/auth/use-role";

const tabs = [
  { href: "/settings/project", label: "Dự án" },
  { href: "/settings/members", label: "Thành viên" },
  { href: "/settings/integrations", label: "Kết nối" },
  { href: "/settings/analysis", label: "Phân tích" },
];

/** Settings tabs filtered by role (FR-018, TC-AUTH-014). UX only — the server enforces. */
export function SettingsTabs() {
  const { role } = useRole();
  const pathname = usePathname();
  return (
    <nav aria-label="Các mục cài đặt" className="mt-4 flex flex-wrap gap-2">
      {tabs
        .filter((t) => canAccess(t.href, role))
        .map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className="plaque-button px-3 py-1.5"
            >
              {t.label}
            </Link>
          );
        })}
    </nav>
  );
}
