"use client";

import type { UserRole } from "@how-about-me/contracts";
import { useCallback } from "react";
import { useCurrentProject } from "./use-current-project";

/** Role in a project (default: current project). Drives UX gating only — the server is the authority (BR-033). */
export function useRole(projectId?: string) {
  const { project, projects, isLoading, error } = useCurrentProject();
  const target = projectId ? (projects.find((p) => p.id === projectId) ?? null) : project;
  const role: UserRole | null = target?.role ?? null;
  const hasRole = useCallback((roles: readonly UserRole[]) => role !== null && roles.includes(role), [role]);
  return { role, settings: target?.settings ?? null, isLoading, error, hasProject: projects.length > 0, hasRole };
}
