"use client";

import { JOB_STATUSES } from "@how-about-me/contracts";
import { NativeSelect } from "@/components/base/select/select-native";
import { useQueryNames } from "./api";
import { jobStatusLabel } from "./format";
import type { SyncJobsParams } from "./use-status-params";

const FIELD = "flex flex-col gap-1.5 text-sm font-medium text-secondary";
const CONTROL =
  "rounded-lg bg-primary px-3 py-2 text-sm text-primary shadow-xs ring-1 ring-primary ring-inset outline-hidden focus-visible:ring-2 focus-visible:ring-brand";

/** Filters for the sync job list (TC-SYS-013): query, status, date range (calendar days in the project tz). */
export function SyncJobsFilters({
  pid,
  value,
  onChange,
}: {
  pid: string;
  value: SyncJobsParams;
  onChange: (patch: Partial<SyncJobsParams>) => void;
}) {
  const options = useQueryNames(pid);
  return (
    // Filter panel (DESIGN.md → Operate Surfaces): white enamel panel with a 2px navy rule, Untitled controls.
    <div className="border-b-2 border-[var(--ink)] bg-[var(--enamel-white)] px-4 py-3">
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NativeSelect
          label="Truy vấn"
          size="sm"
          value={value.queryId}
          options={[{ value: "", label: "Tất cả" }, ...options.map((q) => ({ value: q.id, label: q.name }))]}
          onChange={(e) => onChange({ queryId: e.target.value })}
        />
        <NativeSelect
          label="Trạng thái"
          size="sm"
          value={value.status}
          options={[
            { value: "", label: "Tất cả" },
            ...JOB_STATUSES.map((st) => ({ value: st, label: jobStatusLabel[st].label })),
          ]}
          onChange={(e) => onChange({ status: e.target.value as SyncJobsParams["status"] })}
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
