"use client";

import { PhraseMinMentionsSettingSchema, ValidationErrorDetailsSchema, type Project } from "@how-about-me/contracts";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Input } from "@/components/base/input/input";
import { QueryState } from "@/features/shared/query-state";
import { ApiError } from "@/lib/api/client";
import { errorMessage, useProject, useUpdateProject } from "../api";
import { SettingsSaveBar } from "../settings-save-bar";

const HINT =
  "Cụm từ xuất hiện trong ít bài nhắc hơn sẽ bị ẩn khỏi bản đồ cảm xúc ở chế độ Cụm từ. Số nguyên từ 1 đến 50.";
const INVALID = "Nhập số nguyên từ 1 đến 50.";
const LABEL = "Số lượt nhắc tối thiểu mỗi cụm từ";

/** Parses the string draft; `null` when it is not an integer 1–50 (FR-032, #251). */
export function parsePhraseThreshold(draft: string): number | null {
  if (draft.trim() === "") return null;
  const parsed = PhraseMinMentionsSettingSchema.safeParse(Number(draft));
  return parsed.success ? parsed.data : null;
}

/**
 * Settings → Analysis "Sentiment map" section (FR-032, FR-148, #251). Saves via PATCH /projects/:projectId — a display
 * threshold, so it never creates a policy version or prompts re-analysis. Non-admins read only; the API enforces FR-015.
 */
export function PhraseThresholdForm({ project, canEdit }: { project: Project; canEdit: boolean }) {
  const current = project.settings.phraseMinMentions;
  const [draft, setDraft] = useState(String(current));
  const [serverError, setServerError] = useState<{ field?: string; form?: string }>({});
  const update = useUpdateProject(project.id);
  const value = parsePhraseThreshold(draft);
  const fieldError = value === null ? INVALID : serverError.field;
  // #347: an invalid edit is still unsaved (strip shows, Save disabled).
  const changed = draft !== String(current);
  const dirty = value !== null && value !== current;
  const reset = () => {
    setDraft(String(current));
    setServerError({});
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value === null || !dirty) return;
    setServerError({});
    update.mutate(
      { settings: { phraseMinMentions: value } },
      {
        onSuccess: () => toast.success("Đã lưu cài đặt bản đồ cảm xúc"),
        onError: (err) => {
          const details = err instanceof ApiError ? ValidationErrorDetailsSchema.safeParse(err.details) : null;
          if (err instanceof ApiError && err.code === "VALIDATION_ERROR")
            setServerError({ field: details?.success ? (details.data.issues[0]?.message ?? INVALID) : INVALID });
          else setServerError({ form: errorMessage(err) });
        },
      },
    );
  };

  // #347: read-only is plain text; the admin-only note lives under the Settings tabs.
  if (!canEdit)
    return (
      <dl className="flex max-w-xl flex-col gap-0.5 text-sm">
        <dt className="font-medium text-secondary">{LABEL}</dt>
        <dd className="text-primary tabular-nums">{current}</dd>
        <dd className="text-tertiary">{HINT}</dd>
      </dl>
    );

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-4" aria-label="Cài đặt bản đồ cảm xúc">
      <Input
        label={LABEL}
        type="number"
        value={draft}
        onChange={(v) => {
          setDraft(v);
          setServerError({});
        }}
        isInvalid={!!fieldError}
        hint={fieldError ?? HINT}
      />
      {serverError.form ? (
        <p role="alert" className="text-sm text-error-primary">
          {serverError.form}
        </p>
      ) : null}
      <SettingsSaveBar
        id="phrase-threshold"
        dirty={changed}
        onReset={reset}
        submitLabel="Lưu"
        isDisabled={!dirty}
        isLoading={update.isPending}
      />
    </form>
  );
}

/** Loads the project and remounts the form when its server version changes (pattern of project-settings.tsx). */
export function PhraseThresholdSettings({ pid, canEdit }: { pid: string; canEdit: boolean }) {
  const q = useProject(pid);
  return (
    <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()}>
      {q.data ? <PhraseThresholdForm key={`${pid}:${q.data.updatedAt}`} project={q.data} canEdit={canEdit} /> : null}
    </QueryState>
  );
}
