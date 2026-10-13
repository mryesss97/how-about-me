"use client";

import { usePathname } from "next/navigation";
import { Activity, BarChartSquare02, LogOut01, MessageChatSquare, SearchLg, Settings01 } from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { canAccess } from "@/features/auth/route-roles";
import { useMe } from "@/features/auth/use-me";
import { useRole } from "@/features/auth/use-role";
import { useSignOut } from "@/features/auth/use-sign-out";
import { SidebarNavigationSimple } from "@/components/application/app-navigation/sidebar-navigation/sidebar-simple";
import type { NavItemType } from "@/components/application/app-navigation/config";
import { ProjectSwitcher } from "./project-switcher";

/** Product navigation — docs/01-product/09-ux-specification.md §1. Filtered by role (FR-018); UX only, server enforces. */
const items: NavItemType[] = [
  { label: "Overview", href: "/overview", icon: BarChartSquare02 },
  { label: "Mentions", href: "/mentions", icon: MessageChatSquare },
  { label: "Listening Queries", href: "/listening-queries", icon: SearchLg },
  { label: "System Status", href: "/system-status", icon: Activity },
];
const footerItems: NavItemType[] = [{ label: "Settings", href: "/settings/project", icon: Settings01 }];

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
    <div className="flex flex-col gap-2 border-t border-secondary pt-3">
      <ProjectSwitcher />
      {me.data && (
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-tertiary">{me.data.email}</p>
          {role && (
            <Badge size="sm" color="gray" type="pill-color">
              {role}
            </Badge>
          )}
        </div>
      )}
      <Button color="secondary" size="sm" iconLeading={LogOut01} onClick={() => void signOut()}>
        Sign out
      </Button>
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
