"use client";

import { Tag, TagGroup, TagList } from "@/components/base/tags/tags";
import { type AppliedChip, appliedChips, type Filters, removeFilterValue } from "@/lib/filters";

interface AppliedFilterChipsProps {
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  queryNames?: Record<string, string>;
}

const chipId = (c: AppliedChip) => `${c.key}:${c.value}`;

/** Removable chips for active non-default filters (UX §2.1). */
export function AppliedFilterChips({ filters, setFilters, queryNames }: AppliedFilterChipsProps) {
  const chips = appliedChips(filters, queryNames);
  if (chips.length === 0) return null;
  return (
    <TagGroup label="Applied filters" size="sm">
      <TagList className="flex flex-wrap gap-2" items={chips.map((c) => ({ ...c, id: chipId(c) }))}>
        {(c) => (
          <Tag id={c.id} onClose={() => setFilters(removeFilterValue(filters, c.key, c.value))}>
            {c.label}
          </Tag>
        )}
      </TagList>
    </TagGroup>
  );
}
