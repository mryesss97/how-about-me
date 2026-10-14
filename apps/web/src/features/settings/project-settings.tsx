"use client";

import type { Project } from "@how-about-me/contracts";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { QueryState } from "@/features/shared/query-state";
import { useProject } from "./api";
import { LandingTermsForm } from "./landing-terms-form";
import { ProjectSettingsForm } from "./project-settings-form";

function ProjectSettingsLoaded({ pid, canEdit }: { pid: string; canEdit: boolean }) {
  const q = useProject(pid);
  return (
    <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
      {/* key: reset local form state when the project or its server version changes */}
      {q.data ? (
        <div className="flex flex-col gap-8">
          <ProjectSettingsForm key={projectFormKey(pid, q.data)} project={q.data} canEdit={canEdit} />
          <hr className="border-secondary" />
          {/* #261: separate Save; each form remounts only when its own saved values change, so the other keeps its draft. */}
          <LandingTermsForm
            key={`landing:${pid}:${JSON.stringify(q.data.settings.landingTerms)}`}
            project={q.data}
            canEdit={canEdit}
          />
        </div>
      ) : null}
    </QueryState>
  );
}

/** Page body for `/settings/project`. */
export function ProjectSettings() {
  const { project, isLoading } = useCurrentProject();
  if (isLoading || !project) return <QueryState isLoading>{null}</QueryState>;
  return <ProjectSettingsLoaded pid={project.id} canEdit={project.role === "admin"} />;
}

/** Server values edited by ProjectSettingsForm (#261: not `updatedAt`, which a landing-terms save also bumps). */
function projectFormKey(pid: string, p: Project) {
  const { name, timezone, settings } = p;
  return `${pid}:${JSON.stringify([name, timezone, settings.allowAnalystReanalyze, settings.allowViewerExport])}`;
}
