"use client";

import type { ListeningQuery } from "@how-about-me/contracts";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Button } from "@/components/base/buttons/button";
import { ApiError } from "@/lib/api/client";
import { DASH } from "@/lib/format/number";
import { duplicateExistingId, queryErrorMessage, useCreateListeningQuery, useUpdateListeningQuery } from "./api";
import {
  emptyValues,
  serverIssuesToErrors,
  toCreateBody,
  toUpdateBody,
  validate,
  valuesFromQuery,
  type QueryFormErrors,
  type QueryFormField,
  type QueryFormMode,
  type QueryFormValues,
} from "./query-form";
import { QueryFormFields } from "./query-form-fields";

type Props = {
  pid: string;
  mode: QueryFormMode;
  query?: ListeningQuery;
  isOpen: boolean;
  onClose: () => void;
  /** "Xem truy vấn" on a 409 QUERY_DUPLICATE (FR-053, BR-006). */
  onOpenExisting: (id: string) => void;
  /** "Chạy ngay" action on the create toast (#340 flows-6); the view owns the mutation so it outlives the drawer. */
  onRunNow?: (q: ListeningQuery) => void;
};

/**
 * Create / edit drawer (UX §3.5, FR-052..054). Inline errors show once a field is touched or after the first submit;
 * submit stays disabled while errors remain (TC-LQ-023). Mount with `key={query?.id ?? "new"}` to reset per query.
 */
export function QueryFormDrawer({ pid, mode, query, isOpen, onClose, onOpenExisting, onRunNow }: Props) {
  const [values, setValues] = useState<QueryFormValues>(() => (query ? valuesFromQuery(query) : emptyValues()));
  const [touched, setTouched] = useState<Partial<Record<QueryFormField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<QueryFormErrors>({});
  const [formError, setFormError] = useState<string>();
  const create = useCreateListeningQuery(pid);
  const update = useUpdateListeningQuery(pid);
  const pending = create.isPending || update.isPending;

  const allErrors = useMemo(() => ({ ...validate(values, mode), ...serverErrors }), [values, mode, serverErrors]);
  const shown: QueryFormErrors = submitted
    ? allErrors
    : Object.fromEntries(Object.entries(allErrors).filter(([f]) => touched[f as QueryFormField]));
  const hasErrors = Object.keys(allErrors).length > 0;
  const updateBody = mode === "edit" && query ? toUpdateBody(values, query) : null;
  const unchanged = mode === "edit" && !hasErrors && updateBody === null;

  const set = <K extends QueryFormField>(field: K, value: QueryFormValues[K]) => {
    setValues((v) => ({ ...v, [field]: value }));
    setServerErrors(({ [field]: _drop, ...rest }) => rest);
  };
  const touch = (field: QueryFormField) => setTouched((t) => (t[field] ? t : { ...t, [field]: true }));

  const close = () => {
    setValues(query ? valuesFromQuery(query) : emptyValues());
    setTouched({});
    setSubmitted(false);
    setServerErrors({});
    setFormError(undefined);
    onClose();
  };

  const onError = (err: unknown) => {
    const existingId = duplicateExistingId(err);
    if (existingId) {
      toast.error("Truy vấn này đã tồn tại", {
        action: {
          label: "Xem truy vấn",
          onClick: () => {
            close();
            onOpenExisting(existingId);
          },
        },
      });
      return;
    }
    if (err instanceof ApiError && err.code === "VALIDATION_ERROR") {
      const mapped = serverIssuesToErrors(err.details);
      if (Object.keys(mapped).length > 0) return setServerErrors(mapped);
    }
    setFormError(queryErrorMessage(err));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setFormError(undefined);
    if (hasErrors) return;
    if (mode === "create") {
      const body = toCreateBody(values);
      if (!body) return;
      create.mutate(body, {
        onSuccess: (created) => {
          // Scheduler ticks every 60 s and runs never-synced queries first (ingestion doc §2).
          toast.success("Đã tạo truy vấn", {
            description: "Sẽ đồng bộ trong khoảng 1 phút.",
            action: created.enabled && onRunNow ? { label: "Chạy ngay", onClick: () => onRunNow(created) } : undefined,
          });
          close();
        },
        onError,
      });
    } else if (query && updateBody) {
      update.mutate(
        { id: query.id, body: updateBody },
        {
          onSuccess: () => {
            toast.success("Đã lưu thay đổi");
            close();
          },
          onError,
        },
      );
    }
  };

  const title = mode === "create" ? "THÊM TRUY VẤN" : "SỬA TRUY VẤN";
  return (
    <SlideoutMenu isOpen={isOpen} onOpenChange={(o) => !o && close()} isDismissable className="z-50">
      <SlideoutMenu.Header onClose={close}>
        <h2 className="operate-board-title pr-8 text-[var(--ink)]">{title}</h2>
      </SlideoutMenu.Header>
      <form onSubmit={onSubmit} noValidate aria-label={title} className="flex min-h-0 flex-1 flex-col">
        <SlideoutMenu.Content role="region" aria-label="Thông tin truy vấn" className="pb-6">
          {mode === "edit" && query ? (
            <p className="text-sm text-tertiary">
              Người tạo: {query.createdBy ? (query.createdBy.displayName ?? query.createdBy.email ?? DASH) : DASH}
            </p>
          ) : null}
          <QueryFormFields mode={mode} values={values} errors={shown} set={set} touch={touch} />
          {formError ? (
            <p role="alert" className="text-sm text-error-primary">
              {formError}
            </p>
          ) : null}
        </SlideoutMenu.Content>
        <SlideoutMenu.Footer className="flex justify-end gap-3">
          <Button type="button" color="secondary" onClick={close}>
            Huỷ
          </Button>
          <Button type="submit" isDisabled={Object.keys(shown).length > 0 || unchanged} isLoading={pending}>
            {mode === "create" ? "Tạo truy vấn" : "Lưu"}
          </Button>
        </SlideoutMenu.Footer>
      </form>
    </SlideoutMenu>
  );
}
