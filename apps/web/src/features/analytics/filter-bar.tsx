"use client";

import { Button } from "@/components/base/buttons/button";
import { CopyLinkButton } from "@/features/shared/copy-link-button";
import { isDefaultFilters } from "@/lib/filters";
import { useFilters } from "@/lib/filters/use-filters";
import { AppliedFilterChips } from "./applied-filter-chips";
import { CompareToggle, QueryFilter, RelevanceFilter } from "./filter-controls";
import { FilterSheet } from "./filter-sheet";
import { MoreFiltersPopover } from "./more-filters-popover";
import { DateRangeControl, TimePresets } from "./time-controls";
import { useQueryFilterOptions } from "./use-query-options";

interface FilterBarProps {
  showCompare?: boolean;
  /** Mentions list mode: shows list-only info chips (#328). */
  mentions?: boolean;
  /** #349: "Sao chép liên kết" (Overview, term detail). Mentions has it in its toolbar instead. */
  shareLink?: boolean;
}

/**
 * Sticky shared filter bar for Overview, Mentions and term detail — UX §2.1, FR-130/131, #332.
 * `lg`+: one row, secondary filters in "Bộ lọc khác (n)". Below `lg`: summary strip + bottom sheet under the
 * 56px mobile header (`top-14`). `z-30`: above card stretched links, below mobile header (40) and modals (50).
 * State lives in the URL (nuqs).
 */
export function FilterBar({ showCompare = false, mentions = false, shareLink = false }: FilterBarProps) {
  const { filters, setFilters, reset } = useFilters();
  // FR-051/FR-130: options come from the project's listening queries (incl. soft-deleted, #329).
  const { items: queryItems, names: queryNames } = useQueryFilterOptions();
  const control = { filters, setFilters };

  return (
    <section
      aria-label="Bộ lọc"
      className="sticky top-14 z-30 border-b-2 border-[var(--ink)] bg-[var(--enamel-white)] lg:top-0"
    >
      <div className="lg:hidden">
        <FilterSheet
          {...control}
          reset={reset}
          showCompare={showCompare}
          mentions={mentions}
          queryItems={queryItems}
          queryNames={queryNames}
          extra={shareLink ? <CopyLinkButton compact /> : null}
        />
      </div>
      <div className="hidden flex-col gap-2 px-4 py-2 lg:flex">
        <div className="flex flex-wrap items-end gap-3">
          <TimePresets {...control} />
          <DateRangeControl {...control} />
          <QueryFilter {...control} items={queryItems} />
          <RelevanceFilter {...control} />
          <MoreFiltersPopover {...control} />
          {showCompare && <CompareToggle {...control} />}
          {!isDefaultFilters(filters) && (
            <Button size="sm" color="secondary" onClick={reset}>
              Đặt lại
            </Button>
          )}
          {shareLink && (
            <div className="ml-auto">
              <CopyLinkButton />
            </div>
          )}
        </div>
        <AppliedFilterChips filters={filters} setFilters={setFilters} queryNames={queryNames} mentions={mentions} />
      </div>
    </section>
  );
}
