"use client";

import { useCurrentProject } from "@/features/auth/use-current-project";
import { QueryState } from "@/features/shared/query-state";
import { useProject } from "./api";
import { ProjectSettingsForm } from "./project-settings-form";

function ProjectSettingsLoaded({ pid, canEdit }: { pid: string; canEdit: boolean }) {
  const q = useProject(pid);
  return (
    <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
      {/* key: reset local form state when the project or its server version changes */}
      {q.data ? <ProjectSettingsForm key={`${pid}:${q.data.updatedAt}`} project={q.data} canEdit={canEdit} /> : null}
    </QueryState>
  );
}

/** Page body for `/settings/project`. */
export function ProjectSettings() {
  const { project, isLoading } = useCurrentProject();
  if (isLoading || !project) return <QueryState isLoading>{null}</QueryState>;
  return <ProjectSettingsLoaded pid={project.id} canEdit={project.role === "admin"} />;
}
