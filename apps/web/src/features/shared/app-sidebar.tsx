"use client";

import { usePathname } from "next/navigation";
import { Activity, BarChartSquare02, MessageChatSquare, SearchLg, Settings01 } from "@untitledui/icons";
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
  return <SidebarNavigationSimple activeUrl={active} items={items} footerItems={footerItems} />;
}
