"use client";

import {
  UpdateProjectBodySchema,
  ValidationErrorDetailsSchema,
  type Project,
  type UpdateProjectBody,
} from "@how-about-me/contracts";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { ComboBox } from "@/components/base/select/combobox";
import { SelectItem } from "@/components/base/select/select-item";
import { Toggle } from "@/components/base/toggle/toggle";
import { ApiError } from "@/lib/api/client";
import { errorMessage, useUpdateProject } from "./api";

type FieldErrors = Partial<Record<"name" | "timezone" | "form", string>>;

/** IANA zones from the runtime (client only — lists differ between engines), always including UTC and the current value. */
function timezoneOptions(current: string) {
  const zones = new Set(typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []);
  zones.add("UTC");
  zones.add(current);
  return [...zones].sort().map((z) => ({ id: z, label: z }));
}

/** Only the changed fields go into the PATCH body (FR-032); `settings` is a partial patch. */
export function diffProject(project: Project, name: string, timezone: string, settings: Project["settings"]) {
  const body: UpdateProjectBody = {};
  if (name.trim() !== project.name) body.name = name;
  if (timezone !== project.timezone) body.timezone = timezone;
  const s: NonNullable<UpdateProjectBody["settings"]> = {};
  if (settings.allowAnalystReanalyze !== project.settings.allowAnalystReanalyze)
    s.allowAnalystReanalyze = settings.allowAnalystReanalyze;
  if (settings.allowViewerExport !== project.settings.allowViewerExport)
    s.allowViewerExport = settings.allowViewerExport;
  if (Object.keys(s).length > 0) body.settings = s;
  return body;
}

function errorsFromIssues(issues: { path: string; message: string }[]): FieldErrors {
  const out: FieldErrors = {};
  for (const i of issues) {
    const key = i.path.split(".")[0];
    if (key === "name" || key === "timezone") out[key] ??= i.message;
    else out.form ??= i.message;
  }
  return out;
}

/** Settings → Project (UX §3.7). Non-admins get a read-only form; the API enforces FR-015 / BR-033. */
export function ProjectSettingsForm({ project, canEdit }: { project: Project; canEdit: boolean }) {
  const [name, setName] = useState(project.name);
  const [timezone, setTimezone] = useState(project.timezone);
  const [settings, setSettings] = useState(project.settings);
  const [errors, setErrors] = useState<FieldErrors>({});
  const update = useUpdateProject(project.id);
  const zones = useMemo(() => timezoneOptions(project.timezone), [project.timezone]);

  const body = diffProject(project, name, timezone, settings);
  const dirty = Object.keys(body).length > 0;
  const readOnly = !canEdit;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = UpdateProjectBodySchema.safeParse(body);
    if (!parsed.success) {
      setErrors(errorsFromIssues(parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))));
      return;
    }
    setErrors({});
    update.mutate(parsed.data, {
      onSuccess: () => toast.success("Project saved"),
      onError: (err) => {
        const details = err instanceof ApiError ? ValidationErrorDetailsSchema.safeParse(err.details) : null;
        if (err instanceof ApiError && err.code === "VALIDATION_ERROR" && details?.success)
          setErrors(errorsFromIssues(details.data.issues));
        else setErrors({ form: errorMessage(err) });
      },
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-5" aria-label="Project settings">
      <Input
        label="Project name"
        value={name}
        onChange={setName}
        isDisabled={readOnly}
        isInvalid={!!errors.name}
        hint={errors.name}
      />
      <ComboBox
        label="Timezone"
        items={zones}
        selectedKey={timezone}
        onSelectionChange={(k) => k && setTimezone(String(k))}
        isDisabled={readOnly}
        isInvalid={!!errors.timezone}
        hint={errors.timezone}
        shortcut={false}
      >
        {(item) => <SelectItem id={item.id} label={item.label} />}
      </ComboBox>
      {/* FR-032 / T-107: each permission toggle explains its effect; /me is refetched after Save. */}
      <Toggle
        label="Allow analysts to re-analyze"
        hint="Analysts can queue re-analysis for mentions. Admins always can."
        isSelected={settings.allowAnalystReanalyze}
        onChange={(v) => setSettings((s) => ({ ...s, allowAnalystReanalyze: v }))}
        isDisabled={readOnly}
      />
      <Toggle
        label="Allow viewers to export"
        hint="Viewers can download CSV exports of mentions and analytics."
        isSelected={settings.allowViewerExport}
        onChange={(v) => setSettings((s) => ({ ...s, allowViewerExport: v }))}
        isDisabled={readOnly}
      />
      {errors.form ? (
        <p role="alert" className="text-sm text-error-primary">
          {errors.form}
        </p>
      ) : null}
      {readOnly ? (
        <p className="text-sm text-tertiary">Only project admins can change these settings.</p>
      ) : (
        <div>
          <Button type="submit" isDisabled={!dirty} isLoading={update.isPending}>
            Save
          </Button>
        </div>
      )}
    </form>
  );
}
