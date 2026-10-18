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
import { useMobileNav } from "@/components/application/app-navigation/base-components/mobile-header";
import { SidebarNavigationSimple } from "@/components/application/app-navigation/sidebar-navigation/sidebar-simple";
import type { NavItemType } from "@/components/application/app-navigation/config";
import { ProjectSwitcher } from "./project-switcher";
import { roleLabelVi } from "@/lib/semantics/labels";

/** Product navigation — docs/01-product/09-ux-specification.md §1. Filtered by role (FR-018); UX only, server enforces. */
type ShellNavItem = NavItemType & { match?: string };

const items: ShellNavItem[] = [
  { label: "Tổng quan", href: "/overview", icon: BarChartSquare02 },
  { label: "Bài nhắc", href: "/mentions", icon: MessageChatSquare },
  { label: "Truy vấn theo dõi", href: "/listening-queries", icon: SearchLg },
  { label: "Cần xem lại", href: "/reviews", icon: CheckDone01 },
  { label: "Trạng thái hệ thống", href: "/system-status", icon: Activity },
];
// #325: "Cài đặt" is current on every /settings/* tab.
const footerItems: ShellNavItem[] = [
  { label: "Cài đặt", href: "/settings/project", icon: Settings01, match: "/settings" },
];

/**
 * #325: the current nav item is the one whose `match` (default `href`) is the longest
 * segment-aligned prefix of the pathname. Exactly one item is current, or none (BR-017: shown
 * as a plate + aria-current, not colour alone). FR-018: callers pass only role-visible items.
 */
export function resolveActiveHref(pathname: string, list: ShellNavItem[]): string | undefined {
  let best: ShellNavItem | undefined;
  for (const item of list) {
    const match = item.match ?? item.href;
    if (!match) continue;
    if (pathname !== match && !pathname.startsWith(`${match}/`)) continue;
    if (!best || match.length > (best.match ?? best.href ?? "").length) best = item;
  }
  return best?.href;
}

export function AppSidebar() {
  const pathname = usePathname();
  const me = useMe();
  const { role } = useRole();
  const signOut = useSignOut();
  // Until the role loads only open routes are shown, so restricted items never flash.
  const visible = (list: ShellNavItem[]) => list.filter((i) => !i.href || canAccess(i.href, role));
  const navItems = visible(items);
  const navFooter = visible(footerItems);
  const active = resolveActiveHref(pathname, [...navItems, ...navFooter]);
  // FR-011: sign out clears the session and the query cache.
  const account = (
    <div className="flex flex-col gap-3 border-t-2 border-white/90 pt-4">
      <ProjectSwitcher />
      {me.data && (
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-white">{me.data.email}</p>
          {role && <span className="shell-role-plate">{roleLabelVi[role]}</span>}
        </div>
      )}
      <SignOutButton onSignOut={signOut} />
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

/** Rendered inside the drawer too, so it can reach the mobile menu context (#325). */
function SignOutButton({ onSignOut }: { onSignOut: () => Promise<void> | void }) {
  const mobileNav = useMobileNav();
  return (
    <button
      type="button"
      className="shell-signout"
      onClick={() => {
        mobileNav?.close();
        void onSignOut();
      }}
    >
      <LogOut01 aria-hidden className="size-4" />
      Đăng xuất
    </button>
  );
}
