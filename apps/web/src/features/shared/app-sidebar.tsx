"use client";

import { usePathname } from "next/navigation";
import {
  Activity,
  BarChartSquare02,
  CheckDone01,
  LogOut01,
  MessageChatSquare,
  SearchLg,
  Settings01,
} from "@untitledui/icons";
import { canAccess } from "@/features/auth/route-roles";
import { useMe } from "@/features/auth/use-me";
import { useRole } from "@/features/auth/use-role";
import { useSignOut } from "@/features/auth/use-sign-out";
import { SidebarNavigationSimple } from "@/components/application/app-navigation/sidebar-navigation/sidebar-simple";
import type { NavItemType } from "@/components/application/app-navigation/config";
import { ProjectSwitcher } from "./project-switcher";

/** Product navigation — docs/01-product/09-ux-specification.md §1. Filtered by role (FR-018); UX only, server enforces. */
const items: NavItemType[] = [
  { label: "Tổng quan", href: "/overview", icon: BarChartSquare02 },
  { label: "Bài nhắc", href: "/mentions", icon: MessageChatSquare },
  { label: "Truy vấn theo dõi", href: "/listening-queries", icon: SearchLg },
  { label: "Cần xem lại", href: "/reviews", icon: CheckDone01 },
  { label: "Trạng thái hệ thống", href: "/system-status", icon: Activity },
];
const footerItems: NavItemType[] = [{ label: "Cài đặt", href: "/settings/project", icon: Settings01 }];

/** Role names on the account card (#274, Vietnamese shell). */
const ROLE_LABEL = { admin: "Quản trị", analyst: "Phân tích", viewer: "Chỉ xem" } as const;

export function AppSidebar() {
  const pathname = usePathname();
  const me = useMe();
  const { role } = useRole();
  const signOut = useSignOut();
  // Until the role loads only open routes are shown, so restricted items never flash.
  const visible = (list: NavItemType[]) => list.filter((i) => !i.href || canAccess(i.href, role));
  const navItems = visible(items);
  const navFooter = visible(footerItems);
  const active = [...navItems, ...navFooter].find((i) => i.href && pathname.startsWith(i.href))?.href ?? pathname;
  // FR-011: sign out clears the session and the query cache.
  const account = (
    <div className="flex flex-col gap-3 border-t-2 border-white/90 pt-4">
      <ProjectSwitcher />
      {me.data && (
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-white">{me.data.email}</p>
          {role && <span className="shell-role-plate">{ROLE_LABEL[role]}</span>}
        </div>
      )}
      <button type="button" className="shell-signout" onClick={() => void signOut()}>
        <LogOut01 aria-hidden className="size-4" />
        Đăng xuất
      </button>
    </div>
  );
  return (
    <SidebarNavigationSimple
      activeUrl={active}
      items={navItems}
      footerItems={navFooter}
      featureCard={account}
      showAccountCard={false}
    />
  );
}
