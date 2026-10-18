"use client";

import { JOB_STATUSES, type JobStatus } from "@how-about-me/contracts";
import { NativeSelect } from "@/components/base/select/select-native";
import { plaqueClassName } from "@/features/shared/plaque-button";
import { useQueryNames } from "./api";
import { DateRangeFields, FilterPanel } from "./filter-panel";
import { activeFilterCount, jobStatusLabel } from "./format";
import type { SyncJobsParams } from "./use-status-params";

/** #343 quick status plaques; one `status` per URL ("Đang chạy" = `running` only). */
const QUICK: { label: string; status: JobStatus | "" }[] = [
  { label: "Tất cả", status: "" },
  { label: "Lỗi", status: "failed" },
  { label: "Một phần", status: "partial" },
  { label: "Đang chạy", status: "running" },
];

type Props = {
  pid: string;
  value: SyncJobsParams;
  onChange: (patch: Partial<SyncJobsParams>) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
};

/** Filters for the sync job list (TC-SYS-013, #343): quick status, query, status, date range (project tz). */
export function SyncJobsFilters({ pid, value, onChange, onRefresh, isRefreshing }: Props) {
  const options = useQueryNames(pid);
  const quick = (
    <div role="group" aria-label="Lọc nhanh theo trạng thái" className="flex flex-wrap gap-2">
      {QUICK.map((q) => {
        // A status picked in the select that has no plaque (queued/success/cancelled) lights none of them.
        const selected = value.status === q.status;
        return (
          <button
            key={q.label}
            type="button"
            className={plaqueClassName("sm", "min-h-11 shrink-0 whitespace-nowrap")}
            aria-pressed={selected}
            data-selected={selected ? "true" : undefined}
            onClick={() => onChange({ status: q.status })}
          >
            {q.label}
          </button>
        );
      })}
    </div>
  );
  return (
    <FilterPanel
      fieldsId="sync-jobs-filter-fields"
      activeCount={activeFilterCount(value)}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      quick={quick}
      gridClassName="lg:grid-cols-4"
    >
      <div className="col-span-2 md:col-span-1">
        <NativeSelect
          label="Truy vấn"
          size="sm"
          value={value.queryId}
          options={[{ value: "", label: "Tất cả" }, ...options.map((q) => ({ value: q.id, label: q.name }))]}
          onChange={(e) => onChange({ queryId: e.target.value })}
        />
      </div>
      <div className="col-span-2 md:col-span-1">
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
      </div>
      <DateRangeFields from={value.from} to={value.to} onChange={onChange} />
    </FilterPanel>
  );
}
