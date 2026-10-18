"use client";

import { AUDIT_ACTIONS } from "@how-about-me/contracts";
import { NativeSelect } from "@/components/base/select/select-native";
import { auditActionLabel } from "./format";
import type { AuditLogParams } from "./use-status-params";

const FIELD = "flex flex-col gap-1.5 text-sm font-medium text-secondary";
const CONTROL =
  "rounded-lg bg-primary px-3 py-2 text-sm text-primary shadow-xs ring-1 ring-primary ring-inset outline-hidden focus-visible:ring-2 focus-visible:ring-brand";

/** Filters for the audit log (FR-201): action + date range (calendar days in the project tz). */
export function AuditLogFilters({
  value,
  onChange,
}: {
  value: AuditLogParams;
  onChange: (patch: Partial<AuditLogParams>) => void;
}) {
  return (
    <div className="border-b-2 border-[var(--ink)] bg-[var(--enamel-white)] px-4 py-3">
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
        <NativeSelect
          label="Thao tác"
          size="sm"
          value={value.action}
          options={[
            { value: "", label: "Tất cả" },
            ...AUDIT_ACTIONS.map((a) => ({ value: a, label: auditActionLabel[a] })),
          ]}
          onChange={(e) => onChange({ action: e.target.value as AuditLogParams["action"] })}
        />
        <label className={FIELD}>
          Từ ngày
          <input
            type="date"
            className={CONTROL}
            value={value.from}
            max={value.to || undefined}
            onChange={(e) => onChange({ from: e.target.value })}
          />
        </label>
        <label className={FIELD}>
          Đến ngày
          <input
            type="date"
            className={CONTROL}
            value={value.to}
            min={value.from || undefined}
            onChange={(e) => onChange({ to: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
