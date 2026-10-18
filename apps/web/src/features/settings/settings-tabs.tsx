"use client";

import { usePathname } from "next/navigation";
import { canAccess } from "@/features/auth/route-roles";
import { useRole } from "@/features/auth/use-role";
import { SectionTabs } from "@/features/shared/section-tabs";
import { useUnsavedChanges } from "./unsaved-changes";

const tabs = [
  { href: "/settings/project", label: "Dự án" },
  { href: "/settings/members", label: "Thành viên" },
  { href: "/settings/integrations", label: "Kết nối" },
  { href: "/settings/analysis", label: "Phân tích" },
];

/** Settings tabs filtered by role (FR-018, TC-AUTH-014); guarded by unsaved changes (#347). UX only — the server enforces. */
export function SettingsTabs() {
  const { role } = useRole();
  const pathname = usePathname();
  const { anyDirty, confirmLeave } = useUnsavedChanges();
  const items = tabs
    .filter((t) => canAccess(t.href, role))
    .map((t) => ({
      href: t.href,
      label: t.label,
      current: pathname === t.href || pathname.startsWith(`${t.href}/`),
    }));
  return (
    <SectionTabs
      ariaLabel="Các mục cài đặt"
      items={items}
      onNavigate={(href, e) => {
        // #347: unsaved edits → confirm before switching tab (the dialog navigates on "Bỏ thay đổi").
        if (!anyDirty || href === pathname) return;
        e.preventDefault();
        confirmLeave(href);
      }}
    />
  );
}
