"use client";

import type { ReactNode } from "react";
import { EmptyState } from "@/features/shared/query-state";
import { useCurrentProject } from "./use-current-project";

/** Signed in but not a member of any project: nothing to show (FR-018, FR-031). */
export function NoProjectState() {
  return (
    <EmptyState
      illustration="empty"
      title="You are not a member of any project."
      description="Ask an admin to invite you."
    />
  );
}

/**
 * App-shell gate: once `/me` shows zero memberships, replace the page with {@link NoProjectState}.
 * Loading and errors pass through, so pages keep their own loading/error states. UX only — the API enforces.
 */
export function RequireProject({ children }: { children: ReactNode }) {
  const { projects, isLoading, error } = useCurrentProject();
  if (!isLoading && !error && projects.length === 0) return <NoProjectState />;
  return <>{children}</>;
}
