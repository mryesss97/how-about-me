"use client";

import { useCurrentProject } from "@/features/auth/use-current-project";
import { QueryState } from "@/features/shared/query-state";
import { SettingsBoard } from "../settings-board";
import { useThreadsIntegration } from "./api";
import { ThreadsIntegrationCard } from "./threads-integration-card";

function Loaded({ pid, canEdit, timezone }: { pid: string; canEdit: boolean; timezone: string }) {
  const q = useThreadsIntegration(pid);
  return (
    <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
      {q.data ? (
        <SettingsBoard title="Kết nối Threads">
          <ThreadsIntegrationCard pid={pid} status={q.data} canEdit={canEdit} timezone={timezone} />
        </SettingsBoard>
      ) : null}
    </QueryState>
  );
}

/** Page body for `/settings/integrations` (FR-043, FR-044). */
export function IntegrationsSettings() {
  const { project, isLoading } = useCurrentProject();
  if (isLoading || !project) return <QueryState isLoading>{null}</QueryState>;
  return <Loaded pid={project.id} canEdit={project.role === "admin"} timezone={project.timezone} />;
}
