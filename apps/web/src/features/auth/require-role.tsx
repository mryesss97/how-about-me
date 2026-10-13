"use client";

import type { UserRole } from "@how-about-me/contracts";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import { ErrorState, ForbiddenState, SkeletonBlock } from "@/features/shared/query-state";
import { NoProjectState } from "./require-project";
import { useRole } from "./use-role";

export type RequireRoleProps = {
  roles: readonly UserRole[];
  children: ReactNode;
  /**
   * Rendered when denied. Defaults to the full-page Forbidden state; pass `null` to hide an action.
   * With `fallback` set, loading, a failed `/me` and "no project" also render nothing (the action stays hidden).
   */
  fallback?: ReactNode;
  projectId?: string;
};

/** UX gating only — server enforces (FR-015, FR-018, BR-033). Never flashes forbidden while `/me` loads. */
export function RequireRole({ roles, children, fallback, projectId }: RequireRoleProps) {
  const { isLoading, error, hasProject, hasRole } = useRole(projectId);
  const isPage = fallback === undefined;

  if (isLoading) return isPage ? <SkeletonBlock className="p-6" /> : null;
  if (error) {
    if (!isPage) return null;
    const e = error instanceof ApiError ? { code: error.code, message: error.message, requestId: error.requestId } : {};
    return <ErrorState error={e} />;
  }
  if (!hasProject) return isPage ? <NoProjectState /> : null;
  if (!hasRole(roles)) return isPage ? <ForbiddenState /> : fallback;
  return <>{children}</>;
}
