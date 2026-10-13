"use client";

import { useState } from "react";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { QueryState } from "@/features/shared/query-state";
import { useAnalysisSettings } from "./api";
import { AnalysisSettingsForm } from "./analysis-settings-form";
import { ReanalysisPromptDialog } from "./reanalysis-prompt-dialog";

/** Loaded view; the re-analysis prompt lives here because the form remounts on a new policy version. */
export function AnalysisSettingsPanel({
  pid,
  canEdit,
  timeZone,
}: {
  pid: string;
  canEdit: boolean;
  timeZone?: string;
}) {
  const q = useAnalysisSettings(pid);
  const [prompt, setPrompt] = useState<number | null>(null);
  return (
    <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
      {/* key: reset the draft when the project or the policy version changes */}
      {q.data ? (
        <AnalysisSettingsForm
          key={`${pid}:${q.data.version}`}
          pid={pid}
          settings={q.data}
          canEdit={canEdit}
          timeZone={timeZone}
          onSaved={(s) => s.outdatedCount > 0 && setPrompt(s.outdatedCount)}
        />
      ) : null}
      <ReanalysisPromptDialog isOpen={prompt !== null} outdatedCount={prompt ?? 0} onClose={() => setPrompt(null)} />
    </QueryState>
  );
}

/** Page body for `/settings/analysis` (FR-190). Every role can view; only admins edit. */
export function AnalysisSettings() {
  const { project, isLoading } = useCurrentProject();
  if (isLoading || !project) return <QueryState isLoading>{null}</QueryState>;
  return <AnalysisSettingsPanel pid={project.id} canEdit={project.role === "admin"} timeZone={project.timezone} />;
}
