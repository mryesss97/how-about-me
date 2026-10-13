"use client";

import { usePathname } from "next/navigation";
import { Activity, BarChartSquare02, LogOut01, MessageChatSquare, SearchLg, Settings01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { useMe } from "@/features/auth/use-me";
import { useSignOut } from "@/features/auth/use-sign-out";
import { SidebarNavigationSimple } from "@/components/application/app-navigation/sidebar-navigation/sidebar-simple";
import type { NavItemType } from "@/components/application/app-navigation/config";

/** Product navigation — docs/01-product/09-ux-specification.md §1. Role filtering and project switcher arrive in T-033. */
const items: NavItemType[] = [
  { label: "Overview", href: "/overview", icon: BarChartSquare02 },
  { label: "Mentions", href: "/mentions", icon: MessageChatSquare },
  { label: "Listening Queries", href: "/listening-queries", icon: SearchLg },
  { label: "System Status", href: "/system-status", icon: Activity },
];
const footerItems: NavItemType[] = [{ label: "Settings", href: "/settings/project", icon: Settings01 }];

export function AppSidebar() {
  const pathname = usePathname();
  const active = [...items, ...footerItems].find((i) => i.href && pathname.startsWith(i.href))?.href ?? pathname;
  const me = useMe();
  const signOut = useSignOut();
  // FR-011: sign out clears the session and the query cache.
  const account = (
    <div className="flex flex-col gap-2 border-t border-secondary pt-3">
      {me.data && <p className="truncate text-sm text-tertiary">{me.data.email}</p>}
      <Button color="secondary" size="sm" iconLeading={LogOut01} onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  );
  return (
    <SidebarNavigationSimple
      activeUrl={active}
      items={items}
      footerItems={footerItems}
      featureCard={account}
      showAccountCard={false}
    />
  );
}
