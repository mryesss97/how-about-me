"use client";

import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { Button } from "@/components/base/buttons/button";
import { Toggle } from "@/components/base/toggle/toggle";
import { DEFAULT_RELEVANCE, ENUM_FILTERS, type EnumFilterKey, type Filters } from "@/lib/filters";
import type { RelevanceLabel } from "@how-about-me/taxonomy";
import { useFilters } from "@/lib/filters/use-filters";
import { relevanceBadge } from "@/lib/semantics/badges";
import { displayLabel } from "@/lib/semantics/labels";
import { AppliedFilterChips } from "./applied-filter-chips";
import { EnumMultiSelect } from "./enum-multi-select";
import { TimeControls } from "./time-controls";
import { useQueryFilterOptions } from "./use-query-options";

interface FilterBarProps {
  showCompare?: boolean;
}

const MULTI_SELECTS: { key: Exclude<EnumFilterKey, "relevance">; label: string }[] = [
  { key: "sentiment", label: "Cảm xúc" },
  { key: "safety", label: "An toàn" },
  { key: "intent", label: "Ý định" },
  { key: "topic", label: "Chủ đề" },
  { key: "language", label: "Ngôn ngữ" },
  { key: "analysisStatus", label: "Trạng thái phân tích" },
];

/** Sticky shared filter bar for Overview & Mentions — UX §2.1, FR-130/131. State lives in the URL (nuqs). */
export function FilterBar({ showCompare = false }: FilterBarProps) {
  const { filters, setFilters, reset } = useFilters();
  // FR-051/FR-130: options come from the project's listening queries (incl. soft-deleted, #329).
  const { items: queryItems, names: queryNames } = useQueryFilterOptions();

  return (
    <section
      aria-label="Bộ lọc"
      className="sticky top-0 z-10 flex flex-col gap-3 border-b-2 border-[var(--ink)] bg-[var(--enamel-white)] px-4 py-3"
    >
      <div className="flex flex-wrap items-end gap-3">
        <TimeControls filters={filters} setFilters={setFilters} />
        <EnumMultiSelect
          label="Truy vấn"
          items={queryItems}
          value={filters.queryIds}
          onChange={(queryIds) => setFilters({ queryIds })}
        />
        <ButtonGroup
          size="sm"
          aria-label="Mức liên quan"
          selectionMode="multiple"
          selectedKeys={new Set(filters.relevance)}
          onSelectionChange={(keys) => {
            const next = [...keys].map(String) as RelevanceLabel[];
            // BR-016: empty selection falls back to relevant, never "all".
            setFilters({ relevance: next.length > 0 ? next : [...DEFAULT_RELEVANCE] });
          }}
        >
          {ENUM_FILTERS.relevance.map((r) => (
            <ButtonGroupItem key={r} id={r}>
              {relevanceBadge[r].label}
            </ButtonGroupItem>
          ))}
        </ButtonGroup>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {/* BR-017: sentiment and safety are separate filters. */}
        {MULTI_SELECTS.map(({ key, label }) => (
          <EnumMultiSelect
            key={key}
            label={label}
            items={ENUM_FILTERS[key].map((v) => ({ id: v, label: displayLabel(key, v) }))}
            value={filters[key]}
            onChange={(next) => setFilters({ [key]: next } as Partial<Filters>)}
          />
        ))}
        {showCompare && (
          <Toggle
            label="So sánh với kỳ trước"
            isSelected={filters.compare}
            onChange={(compare) => setFilters({ compare })}
          />
        )}
        <Button size="sm" color="secondary" onClick={reset}>
          Đặt lại
        </Button>
      </div>
      <AppliedFilterChips filters={filters} setFilters={setFilters} queryNames={queryNames} />
    </section>
  );
}
