"use client";

import { Toggle } from "@/components/base/toggle/toggle";
import { DEFAULT_RELEVANCE, ENUM_FILTERS, type Filters } from "@/lib/filters";
import type { RelevanceLabel } from "@how-about-me/taxonomy";
import { relevanceBadge } from "@/lib/semantics/badges";
import { displayLabel } from "@/lib/semantics/labels";
import { SECONDARY_FILTER_KEYS } from "@/lib/filters/filter-summary";
import { EnumMultiSelect } from "./enum-multi-select";
import { type FilterControlProps, TimezoneSelect } from "./time-controls";
import type { SelectItemType } from "@/components/base/select/select-shared";

const SECONDARY_LABEL: Record<(typeof SECONDARY_FILTER_KEYS)[number], string> = {
  sentiment: "Cảm xúc",
  safety: "An toàn",
  intent: "Ý định",
  topic: "Chủ đề",
  language: "Ngôn ngữ",
  analysisStatus: "Trạng thái phân tích",
};

const RELEVANCE_ITEMS = ENUM_FILTERS.relevance.map((r) => ({ id: r, label: relevanceBadge[r].label }));

/** Truy vấn — hidden when the project has no queries, so the bar never shows an empty select (#332). */
export function QueryFilter({
  filters,
  setFilters,
  items,
  className,
}: FilterControlProps & { items: SelectItemType[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <EnumMultiSelect
      label="Truy vấn"
      items={items}
      value={filters.queryIds}
      onChange={(queryIds) => setFilters({ queryIds })}
      className={className}
    />
  );
}

/** Mức liên quan as a multi-select. BR-016: an empty selection (or "Bỏ chọn") falls back to relevant. */
export function RelevanceFilter({ filters, setFilters, className }: FilterControlProps & { className?: string }) {
  const toDefault = () => setFilters({ relevance: [...DEFAULT_RELEVANCE] });
  return (
    <EnumMultiSelect
      label="Mức liên quan"
      items={RELEVANCE_ITEMS}
      value={filters.relevance}
      onChange={(next) => (next.length > 0 ? setFilters({ relevance: next as RelevanceLabel[] }) : toDefault())}
      onReset={toDefault}
      className={className}
    />
  );
}

/** The six secondary enums + timezone ("Bộ lọc khác"). BR-017: sentiment and safety are separate filters. */
export function SecondaryFilters({
  filters,
  setFilters,
  itemClassName,
}: FilterControlProps & { itemClassName?: string }) {
  return (
    <>
      {SECONDARY_FILTER_KEYS.map((key) => (
        <EnumMultiSelect
          key={key}
          label={SECONDARY_LABEL[key]}
          items={ENUM_FILTERS[key].map((v) => ({ id: v, label: displayLabel(key, v) }))}
          value={filters[key]}
          onChange={(next) => setFilters({ [key]: next } as Partial<Filters>)}
          className={itemClassName}
        />
      ))}
      <TimezoneSelect filters={filters} setFilters={setFilters} className={itemClassName} />
    </>
  );
}

export function CompareToggle({ filters, setFilters }: FilterControlProps) {
  return (
    <Toggle label="So sánh với kỳ trước" isSelected={filters.compare} onChange={(compare) => setFilters({ compare })} />
  );
}
