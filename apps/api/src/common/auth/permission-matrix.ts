import type { ProjectSettings } from "@how-about-me/contracts";

/**
 * Executable copy of docs/01-product/02-personas-rbac.md §3 (FR-014…FR-016). Change this table and the doc in the
 * same PR. `test/integration/rbac.int-spec.ts` fails when a mutating `/projects/:projectId` route lacks an entry or its
 * `@Roles` / `@AllowRoleWhenSetting` disagree. A ticket that ships a route flips its entry to `implemented`.
 * Paths are Nest-style without the global `api/v1` prefix.
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type Access = "allow" | "deny" | { setting: keyof ProjectSettings };
export type PermissionEntry = {
  method: HttpMethod;
  path: string;
  admin: Access;
  analyst: Access;
  viewer: Access;
  status: "implemented" | "planned";
};

const P = "projects/:projectId";
const ADMIN_ONLY = { admin: "allow", analyst: "deny", viewer: "deny" } as const;
const ALL = { admin: "allow", analyst: "allow", viewer: "allow" } as const;

export const PERMISSION_MATRIX: readonly PermissionEntry[] = [
  { method: "GET", path: P, ...ALL, status: "implemented" },
  { method: "PATCH", path: P, ...ADMIN_ONLY, status: "implemented" },
  { method: "GET", path: `${P}/members`, ...ADMIN_ONLY, status: "planned" },
  { method: "POST", path: `${P}/members`, ...ADMIN_ONLY, status: "planned" },
  { method: "PATCH", path: `${P}/members/:userId`, ...ADMIN_ONLY, status: "planned" },
  { method: "DELETE", path: `${P}/members/:userId`, ...ADMIN_ONLY, status: "planned" },
  { method: "GET", path: `${P}/integrations/threads`, ...ALL, status: "planned" },
  { method: "PUT", path: `${P}/integrations/threads`, ...ADMIN_ONLY, status: "planned" },
  { method: "POST", path: `${P}/integrations/threads/verify`, ...ADMIN_ONLY, status: "planned" },
  { method: "GET", path: `${P}/listening-queries`, ...ALL, status: "planned" },
  { method: "POST", path: `${P}/listening-queries`, ...ADMIN_ONLY, status: "planned" },
  { method: "PATCH", path: `${P}/listening-queries/:queryId`, ...ADMIN_ONLY, status: "planned" },
  { method: "DELETE", path: `${P}/listening-queries/:queryId`, ...ADMIN_ONLY, status: "planned" },
  { method: "POST", path: `${P}/listening-queries/:queryId/restore`, ...ADMIN_ONLY, status: "planned" },
  { method: "POST", path: `${P}/listening-queries/:queryId/run`, ...ADMIN_ONLY, status: "planned" },
  { method: "POST", path: `${P}/listening-queries/:queryId/backfill`, ...ADMIN_ONLY, status: "planned" },
  { method: "GET", path: `${P}/mentions`, ...ALL, status: "planned" },
  { method: "GET", path: `${P}/mentions/:mentionId`, ...ALL, status: "planned" },
  {
    method: "POST",
    path: `${P}/mentions/:mentionId/reanalyze`,
    admin: "allow",
    analyst: { setting: "allowAnalystReanalyze" },
    viewer: "deny",
    status: "implemented",
  },
  { method: "POST", path: `${P}/mentions/reanalyze`, ...ADMIN_ONLY, status: "planned" },
  {
    method: "POST",
    path: `${P}/mentions/:mentionId/overrides`,
    admin: "allow",
    analyst: "allow",
    viewer: "deny",
    status: "planned",
  },
  {
    method: "DELETE",
    path: `${P}/mentions/:mentionId/overrides`,
    admin: "allow",
    analyst: "allow",
    viewer: "deny",
    status: "planned",
  },
  {
    method: "GET",
    path: `${P}/mentions/export.csv`,
    admin: "allow",
    analyst: "allow",
    viewer: { setting: "allowViewerExport" },
    status: "planned",
  },
  { method: "GET", path: `${P}/sync-jobs`, ...ALL, status: "planned" },
  { method: "GET", path: `${P}/system-status`, ...ALL, status: "planned" },
  { method: "GET", path: `${P}/audit-logs`, ...ADMIN_ONLY, status: "implemented" },
  { method: "PATCH", path: `${P}/settings/analysis`, ...ADMIN_ONLY, status: "planned" },
];
