import type { ProjectToggleSetting } from "./project-settings";

/**
 * Executable copy of docs/01-product/02-personas-rbac.md §3 (FR-014…FR-016). Change this table and the doc in the
 * same PR. `test/integration/rbac.int-spec.ts` fails when a mutating `/projects/:projectId` route lacks an entry or its
 * `@Roles` / `@AllowRoleWhenSetting` disagree. A ticket that ships a route flips its entry to `implemented`.
 * Paths are Nest-style without the global `api/v1` prefix.
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type Access = "allow" | "deny" | { setting: ProjectToggleSetting };
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
  { method: "GET", path: `${P}/members`, ...ADMIN_ONLY, status: "implemented" },
  { method: "POST", path: `${P}/members`, ...ADMIN_ONLY, status: "implemented" },
  { method: "PATCH", path: `${P}/members/:userId`, ...ADMIN_ONLY, status: "implemented" },
  { method: "DELETE", path: `${P}/members/:userId`, ...ADMIN_ONLY, status: "implemented" },
  { method: "GET", path: `${P}/integrations/threads`, ...ALL, status: "implemented" },
  { method: "PUT", path: `${P}/integrations/threads`, ...ADMIN_ONLY, status: "implemented" },
  { method: "POST", path: `${P}/integrations/threads/verify`, ...ADMIN_ONLY, status: "implemented" },
  { method: "DELETE", path: `${P}/integrations/threads`, ...ADMIN_ONLY, status: "implemented" },
  { method: "GET", path: `${P}/listening-queries`, ...ALL, status: "implemented" },
  { method: "GET", path: `${P}/listening-queries/:queryId`, ...ALL, status: "implemented" },
  { method: "POST", path: `${P}/listening-queries`, ...ADMIN_ONLY, status: "implemented" },
  { method: "PATCH", path: `${P}/listening-queries/:queryId`, ...ADMIN_ONLY, status: "implemented" },
  { method: "DELETE", path: `${P}/listening-queries/:queryId`, ...ADMIN_ONLY, status: "implemented" },
  { method: "POST", path: `${P}/listening-queries/:queryId/restore`, ...ADMIN_ONLY, status: "implemented" },
  { method: "POST", path: `${P}/listening-queries/:queryId/run`, ...ADMIN_ONLY, status: "planned" },
  { method: "POST", path: `${P}/listening-queries/:queryId/backfill`, ...ADMIN_ONLY, status: "planned" },
  { method: "GET", path: `${P}/analytics/overview`, ...ALL, status: "implemented" },
  { method: "GET", path: `${P}/analytics/mentions-timeseries`, ...ALL, status: "implemented" },
  { method: "GET", path: `${P}/mentions`, ...ALL, status: "implemented" },
  { method: "GET", path: `${P}/mentions/:mentionId`, ...ALL, status: "implemented" },
  {
    method: "POST",
    path: `${P}/mentions/:mentionId/reanalyze`,
    admin: "allow",
    analyst: { setting: "allowAnalystReanalyze" },
    viewer: "deny",
    status: "implemented",
  },
  { method: "POST", path: `${P}/mentions/reanalyze`, ...ADMIN_ONLY, status: "implemented" },
  {
    method: "POST",
    path: `${P}/mentions/:mentionId/overrides`,
    admin: "allow",
    analyst: "allow",
    viewer: "deny",
    status: "implemented",
  },
  {
    method: "DELETE",
    path: `${P}/mentions/:mentionId/overrides/:overrideId`,
    admin: "allow",
    analyst: "allow",
    viewer: "deny",
    status: "implemented",
  },
  { method: "GET", path: `${P}/reviews`, ...ALL, status: "implemented" },
  {
    method: "POST",
    path: `${P}/reviews/mark-reviewed`,
    admin: "allow",
    analyst: "allow",
    viewer: "deny",
    status: "implemented",
  },
  {
    method: "GET",
    path: `${P}/mentions/export.csv`,
    admin: "allow",
    analyst: "allow",
    viewer: { setting: "allowViewerExport" },
    status: "implemented",
  },
  { method: "GET", path: `${P}/sync-jobs`, ...ALL, status: "implemented" },
  { method: "GET", path: `${P}/sync-jobs/:jobId`, ...ALL, status: "implemented" },
  { method: "POST", path: `${P}/sync-jobs/:jobId/retry`, ...ADMIN_ONLY, status: "implemented" },
  { method: "GET", path: `${P}/system-status`, ...ALL, status: "planned" },
  { method: "GET", path: `${P}/analytics/sentiment`, ...ALL, status: "implemented" },
  { method: "GET", path: `${P}/analytics/safety`, ...ALL, status: "implemented" },
  { method: "GET", path: `${P}/analytics/intents`, ...ALL, status: "implemented" },
  { method: "GET", path: `${P}/analytics/topics`, ...ALL, status: "implemented" },
  { method: "GET", path: `${P}/analytics/query-share`, ...ALL, status: "implemented" },
  { method: "GET", path: `${P}/analytics/languages`, ...ALL, status: "implemented" },
  { method: "GET", path: `${P}/analytics/topic-sentiment`, ...ALL, status: "implemented" },
  { method: "GET", path: `${P}/analytics/phrases`, ...ALL, status: "implemented" },
  { method: "GET", path: `${P}/audit-logs`, ...ADMIN_ONLY, status: "implemented" },
  { method: "GET", path: `${P}/settings/analysis`, ...ALL, status: "implemented" },
  { method: "PATCH", path: `${P}/settings/analysis`, ...ADMIN_ONLY, status: "implemented" },
  { method: "POST", path: `${P}/analysis-runs/mark-stale`, ...ADMIN_ONLY, status: "implemented" },
];
