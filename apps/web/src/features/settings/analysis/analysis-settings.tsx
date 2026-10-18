"use client";

import { useState } from "react";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { QueryState } from "@/features/shared/query-state";
import { useAnalysisSettings } from "./api";
import { AnalysisSettingsForm } from "./analysis-settings-form";
import { PhraseThresholdSettings } from "./phrase-threshold-form";
import { ReanalysisPromptDialog } from "./reanalysis-prompt-dialog";
import { SettingsBoard, SettingsBoardSkeleton } from "../settings-board";

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
  const [prompt, setPrompt] = useState<{ outdatedCount: number; version: string } | null>(null);
  return (
    <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()} errorVariant="inline">
      {/* key: reset the draft when the project or the policy version changes */}
      {q.data ? (
        <AnalysisSettingsForm
          key={`${pid}:${q.data.version}`}
          pid={pid}
          settings={q.data}
          canEdit={canEdit}
          timeZone={timeZone}
          onSaved={(s) => {
            // BR-023: stale the version that was effective before this save (captured from the pre-save render).
            const prev = q.data?.effectiveVersion;
            if (canEdit && prev && s.outdatedCount > 0 && s.effectiveVersion !== prev)
              setPrompt({ outdatedCount: s.outdatedCount, version: prev });
          }}
        />
      ) : null}
      {canEdit && prompt ? (
        <ReanalysisPromptDialog
          key={prompt.version}
          pid={pid}
          version={prompt.version}
          isOpen
          outdatedCount={prompt.outdatedCount}
          onClose={() => setPrompt(null)}
        />
      ) : null}
    </QueryState>
  );
}

/** Page body for `/settings/analysis` (FR-190). Every role can view; only admins edit. */
export function AnalysisSettings() {
  const { project, isLoading } = useCurrentProject();
  if (isLoading || !project) return <SettingsBoardSkeleton title="Chính sách phân tích" />;
  const canEdit = project.role === "admin";
  return (
    <div className="flex flex-col gap-6">
      <SettingsBoard title="Chính sách phân tích">
        <AnalysisSettingsPanel pid={project.id} canEdit={canEdit} timeZone={project.timezone} />
      </SettingsBoard>
      {/* #251: separate form + Save; a display threshold, not a policy version. */}
      <SettingsBoard title="Bản đồ cảm xúc">
        <PhraseThresholdSettings pid={project.id} canEdit={canEdit} />
      </SettingsBoard>
    </div>
  );
}
