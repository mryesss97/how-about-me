"use client";

import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { Button } from "@/components/base/buttons/button";
import { Toggle } from "@/components/base/toggle/toggle";
import { DEFAULT_RELEVANCE, ENUM_FILTERS, type EnumFilterKey, type Filters } from "@/lib/filters";
import type { RelevanceLabel } from "@how-about-me/taxonomy";
import { useFilters } from "@/lib/filters/use-filters";
import { relevanceBadge } from "@/lib/semantics/badges";
import { AppliedFilterChips } from "./applied-filter-chips";
import { humanizeLabel } from "./charts/chart-data";
import { EnumMultiSelect } from "./enum-multi-select";
import { TimeControls } from "./time-controls";

export interface QueryOption {
  id: string;
  name: string;
  type: "keyword" | "tag";
}

interface FilterBarProps {
  showCompare?: boolean;
  queryOptions?: QueryOption[];
}

const MULTI_SELECTS: { key: Exclude<EnumFilterKey, "relevance">; label: string }[] = [
  { key: "sentiment", label: "Sentiment" },
  { key: "safety", label: "Safety" },
  { key: "intent", label: "Intent" },
  { key: "topic", label: "Topic" },
  { key: "language", label: "Language" },
  { key: "analysisStatus", label: "Analysis status" },
];

/** Sticky shared filter bar for Overview & Mentions — UX §2.1, FR-130/131. State lives in the URL (nuqs). */
export function FilterBar({ showCompare = false, queryOptions = [] }: FilterBarProps) {
  const { filters, setFilters, reset } = useFilters();
  const queryNames = Object.fromEntries(queryOptions.map((q) => [q.id, q.type === "tag" ? `#${q.name}` : q.name]));

  return (
    <section
      aria-label="Filters"
      className="sticky top-0 z-10 flex flex-col gap-3 border-b border-secondary bg-secondary py-3"
    >
      <div className="flex flex-wrap items-end gap-3">
        <TimeControls filters={filters} setFilters={setFilters} />
        <EnumMultiSelect
          label="Queries"
          items={queryOptions.map((q) => ({ id: q.id, label: queryNames[q.id] }))}
          value={filters.queryIds}
          onChange={(queryIds) => setFilters({ queryIds })}
        />
        <ButtonGroup
          size="sm"
          aria-label="Relevance"
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
            items={ENUM_FILTERS[key].map((v) => ({ id: v, label: humanizeLabel(v) }))}
            value={filters[key]}
            onChange={(next) => setFilters({ [key]: next } as Partial<Filters>)}
          />
        ))}
        {showCompare && (
          <Toggle
            label="Compare to previous period"
            isSelected={filters.compare}
            onChange={(compare) => setFilters({ compare })}
          />
        )}
        <Button size="sm" color="secondary" onClick={reset}>
          Reset
        </Button>
      </div>
      <AppliedFilterChips filters={filters} setFilters={setFilters} queryNames={queryNames} />
    </section>
  );
}
