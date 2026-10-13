import type { UserRole } from "@how-about-me/contracts";

/**
 * Which roles may *see* a route — one source of truth for sidebar, settings tabs and page guards (FR-018).
 * UX gating only: the API enforces authorization (FR-015, BR-033).
 * `/settings/integrations` excludes viewer per TC-AUTH-014/015 (decision 2026-10-13, ticket #29).
 */
export const ROUTE_ROLES = {
  "/settings/members": ["admin"],
  "/settings/integrations": ["admin", "analyst"],
} as const satisfies Record<string, readonly UserRole[]>;

/** Longest matching prefix wins; undeclared routes are open to every role. `role=null` (not loaded) only sees open routes. */
export function canAccess(pathname: string, role: UserRole | null): boolean {
  const match = Object.keys(ROUTE_ROLES)
    .filter((p) => pathname === p || pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0] as keyof typeof ROUTE_ROLES | undefined;
  if (!match) return true;
  const allowed: readonly UserRole[] = ROUTE_ROLES[match];
  return role !== null && allowed.includes(role);
}
