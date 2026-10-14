"use client";

import { LANDING_TERMS_MAX, ValidationErrorDetailsSchema, type Project } from "@how-about-me/contracts";
import { normalizePhrase } from "@how-about-me/taxonomy";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/base/buttons/button";
import { InputTags } from "@/components/base/input/input-tags";
import { ApiError } from "@/lib/api/client";
import { errorMessage, useUpdateProject } from "./api";

const HINT =
  "Mỗi cụm từ thành một biển hiệu trên trang landing, tô màu theo cảm xúc của các bài nhắc có chứa cụm từ đó trong nội dung hoặc cụm từ khoá. Tối đa 20 cụm từ, mỗi cụm 1–60 ký tự.";
const INVALID = "Nhập 1–60 ký tự, có ít nhất một chữ hoặc số.";
const DUPLICATE = "Đã có trong danh sách.";
const TOO_MANY = "Tối đa 20 cụm từ.";

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** BR-042: why a new term is rejected (normalised like key phrases, BR-041), or `null` when it can be added. */
export function landingTermError(raw: string, current: readonly string[]): string | null {
  const term = normalizePhrase(raw);
  if (term === null) return INVALID;
  if (current.includes(term)) return DUPLICATE;
  if (current.length >= LANDING_TERMS_MAX) return TOO_MANY;
  return null;
}

/**
 * Settings → Project "Landing page" section (FR-032, FR-149, BR-042, #261). Saves only `settings.landingTerms` via
 * PATCH /projects/:projectId. Non-admins read only; the API enforces FR-015.
 */
export function LandingTermsForm({ project, canEdit }: { project: Project; canEdit: boolean }) {
  const current = project.settings.landingTerms;
  const [draft, setDraft] = useState<string[]>(current);
  const [error, setError] = useState<{ field?: string; form?: string }>({});
  const update = useUpdateProject(project.id);
  const dirty = !sameList(draft, current);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    setError({});
    update.mutate(
      { settings: { landingTerms: draft } },
      {
        onSuccess: () => toast.success("Đã lưu cài đặt trang landing"),
        onError: (err) => {
          if (err instanceof ApiError && err.code === "VALIDATION_ERROR") {
            const details = ValidationErrorDetailsSchema.safeParse(err.details);
            setError({ field: details.success ? (details.data.issues[0]?.message ?? INVALID) : INVALID });
          } else setError({ form: errorMessage(err) });
        },
      },
    );
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-4" aria-label="Cài đặt trang landing">
      {!canEdit && current.length === 0 ? (
        <p className="text-sm text-tertiary">Chưa có cụm từ nào.</p>
      ) : (
        <InputTags
          label="Cụm từ trên landing"
          placeholder={canEdit ? "Thêm cụm từ rồi nhấn Enter" : undefined}
          value={draft}
          allowDuplicates
          validate={(raw) => {
            const reason = landingTermError(raw, draft);
            setError(reason ? { field: reason } : {});
            return reason === null;
          }}
          onChange={(tags) => {
            // Newly added tags arrive raw; store them normalised (BR-041) like the server does.
            setDraft(tags.map((t) => normalizePhrase(t) ?? t));
            setError({});
          }}
          isDisabled={!canEdit}
          isInvalid={!!error.field}
          hint={error.field ?? HINT}
        />
      )}
      {error.form ? (
        <p role="alert" className="text-sm text-error-primary">
          {error.form}
        </p>
      ) : null}
      {canEdit ? (
        <div>
          <Button type="submit" isDisabled={!dirty} isLoading={update.isPending}>
            Lưu
          </Button>
        </div>
      ) : (
        <p className="text-sm text-tertiary">Chỉ quản trị viên dự án mới thay đổi được các cài đặt này.</p>
      )}
    </form>
  );
}
