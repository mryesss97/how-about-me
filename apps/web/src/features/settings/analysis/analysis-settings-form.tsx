"use client";

import { ValidationErrorDetailsSchema, type AnalysisSettings } from "@how-about-me/contracts";
import type { SafetyCategory } from "@how-about-me/taxonomy";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/base/badges/badges";
import { Input } from "@/components/base/input/input";
import { ApiError } from "@/lib/api/client";
import { formatCount } from "@/lib/format/number";
import { formatDateTime, formatRelativeOrAbsolute } from "@/lib/time/format";
import { errorMessage } from "../api";
import { SettingsSaveBar } from "../settings-save-bar";
import {
  diffAnalysisSettings,
  errorsFromIssues,
  toDraft,
  validateDraft,
  type AnalysisDraft,
  type PolicyErrors,
  type ThresholdDraft,
} from "./analysis-policy-form-state";
import { AnalysisVersions } from "./analysis-versions";
import { useUpdateAnalysisSettings } from "./api";
import { formatThreshold, SafetyThresholdsTable } from "./safety-thresholds-table";

const BAND_LABEL = { high: "Cao (≥)", medium: "Trung bình (≥)" } as const;

function PolicyHeader({ settings, timeZone }: { settings: AnalysisSettings; timeZone?: string }) {
  const by = settings.createdBy ? (settings.createdBy.displayName ?? settings.createdBy.email) : null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <h3 className="text-md font-semibold text-primary">{settings.policyVersion}</h3>
        {settings.isDefault ? (
          <Badge size="sm" color="gray" type="pill-color">
            Mặc định
          </Badge>
        ) : null}
      </div>
      {settings.isDefault && !by ? (
        <p className="text-sm text-tertiary">Chính sách mặc định (theo taxonomy)</p>
      ) : settings.createdAt ? (
        <p className="text-sm text-tertiary">
          Tạo{" "}
          <time dateTime={settings.createdAt} title={formatDateTime(settings.createdAt, timeZone)}>
            {formatRelativeOrAbsolute(settings.createdAt, new Date(), timeZone)}
          </time>
          {by ? ` bởi ${by}` : null}
        </p>
      ) : null}
      {settings.outdatedCount > 0 ? (
        <p className="text-sm text-tertiary">
          {formatCount(settings.outdatedCount)} bài đã được phân tích bằng chính sách cũ.
        </p>
      ) : null}
    </div>
  );
}

/** Settings → Analysis (UX §3.7, FR-190). Non-admins read only; the API enforces FR-015. */
export function AnalysisSettingsForm({
  pid,
  settings,
  canEdit,
  timeZone,
  onSaved,
}: {
  pid: string;
  settings: AnalysisSettings;
  canEdit: boolean;
  timeZone?: string;
  onSaved?: (s: AnalysisSettings) => void;
}) {
  const [draft, setDraft] = useState<AnalysisDraft>(() => toDraft(settings));
  const [serverErrors, setServerErrors] = useState<PolicyErrors>({});
  const update = useUpdateAnalysisSettings(pid);
  const readOnly = !canEdit;

  // BR-018 / BR-021: re-validated on every change so fixing one cell clears the pair.
  const liveErrors = validateDraft(draft);
  const errors = { ...serverErrors, ...liveErrors };
  const body = diffAnalysisSettings(settings, draft);
  const hasErrors = Object.keys(liveErrors).length > 0;
  const dirty = Object.keys(body).length > 0 || hasErrors;

  const reset = () => {
    setDraft(toDraft(settings));
    setServerErrors({});
  };
  const edit = (fn: (d: AnalysisDraft) => AnalysisDraft) => {
    setDraft(fn);
    setServerErrors({});
  };
  const setBand = (k: "high" | "medium", v: string) => edit((d) => ({ ...d, bands: { ...d.bands, [k]: v } }));
  const setThreshold = (c: SafetyCategory, level: keyof ThresholdDraft, v: string) =>
    edit((d) => ({ ...d, thresholds: { ...d.thresholds, [c]: { ...d.thresholds[c], [level]: v } } }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (hasErrors || Object.keys(body).length === 0) return;
    update.mutate(body, {
      onSuccess: (next) => {
        // "No changes" only happens on a race (another admin saved the same values first); the API creates no version.
        toast.success(next.version !== settings.version ? `Đã tạo ${next.policyVersion}` : "Không có thay đổi");
        onSaved?.(next);
      },
      onError: (err) => {
        const details = err instanceof ApiError ? ValidationErrorDetailsSchema.safeParse(err.details) : null;
        if (err instanceof ApiError && err.code === "VALIDATION_ERROR" && details?.success)
          setServerErrors(errorsFromIssues(details.data.issues, draft));
        else setServerErrors({ form: errorMessage(err) });
      },
    });
  };

  // #347 order: policy → bands → thresholds → errors → save bar → technical versions (after the bar).
  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-3xl flex-col gap-6" aria-label="Cài đặt phân tích">
      <PolicyHeader settings={settings} timeZone={timeZone} />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-semibold text-primary">Ngưỡng độ tin cậy</legend>
        {readOnly ? (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {(["high", "medium"] as const).map((k) => (
              <div key={k} className="flex flex-col gap-0.5">
                <dt className="font-medium text-secondary">{BAND_LABEL[k]}</dt>
                <dd className="text-primary tabular-nums">{formatThreshold(draft.bands[k])}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {(["high", "medium"] as const).map((k) => (
              <Input
                key={k}
                label={BAND_LABEL[k]}
                type="number"
                value={draft.bands[k]}
                onChange={(v) => setBand(k, v)}
                isInvalid={!!errors[`confidenceBands.${k}`]}
                hint={errors[`confidenceBands.${k}`]}
              />
            ))}
          </div>
        )}
      </fieldset>
      <SafetyThresholdsTable
        thresholds={draft.thresholds}
        errors={errors}
        readOnly={readOnly}
        onChange={setThreshold}
      />
      {errors.form ? (
        <p role="alert" className="text-sm text-error-primary">
          {errors.form}
        </p>
      ) : null}
      {readOnly ? null : (
        <SettingsSaveBar
          id="analysis-policy"
          dirty={dirty}
          onReset={reset}
          submitLabel="Tạo phiên bản chính sách mới"
          isDisabled={hasErrors}
          isLoading={update.isPending}
          flushBottom={false}
        />
      )}
      <AnalysisVersions settings={settings} />
    </form>
  );
}
