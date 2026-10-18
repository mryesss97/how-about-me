"use client";

import { AUDIT_ACTIONS } from "@how-about-me/contracts";
import { NativeSelect } from "@/components/base/select/select-native";
import { DateRangeFields, FilterPanel } from "./filter-panel";
import { activeFilterCount, auditActionLabel } from "./format";
import type { AuditLogParams } from "./use-status-params";

type Props = {
  value: AuditLogParams;
  onChange: (patch: Partial<AuditLogParams>) => void;
  /** #343: project members for "Người thực hiện" (no "Hệ thống": `actorUserId` only takes a UUID). */
  members: { id: string; name: string }[];
  onRefresh: () => void;
  isRefreshing: boolean;
};

/** Filters for the audit log (FR-201, #343): action, actor, date range (calendar days in the project tz). */
export function AuditLogFilters({ value, onChange, members, onRefresh, isRefreshing }: Props) {
  return (
    <FilterPanel
      fieldsId="audit-log-filter-fields"
      activeCount={activeFilterCount(value)}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      gridClassName="lg:grid-cols-4"
    >
      <div className="col-span-2 md:col-span-1">
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
      </div>
      <div className="col-span-2 md:col-span-1">
        <NativeSelect
          label="Người thực hiện"
          size="sm"
          value={value.actor}
          options={[{ value: "", label: "Tất cả" }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
          onChange={(e) => onChange({ actor: e.target.value })}
        />
      </div>
      <DateRangeFields from={value.from} to={value.to} onChange={onChange} />
    </FilterPanel>
  );
}
