"use client";

import { Button as AriaButton } from "react-aria-components";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Button } from "@/components/base/buttons/button";
import type { SelectItemType } from "@/components/base/select/select-shared";
import { activeFilterCount, isDefaultFilters, rangeLabel } from "@/lib/filters";
import { AppliedFilterChips } from "./applied-filter-chips";
import { CompareToggle, QueryFilter, RelevanceFilter, SecondaryFilters } from "./filter-controls";
import { DateRangeControl, type FilterControlProps, PRESET_LABEL, TimePresets } from "./time-controls";

interface FilterSheetProps extends FilterControlProps {
  reset: () => void;
  showCompare: boolean;
  mentions: boolean;
  queryItems: SelectItemType[];
  queryNames: Record<string, string>;
}

/** Below `lg`: one 48px sticky summary strip; the plaque opens every filter in a bottom sheet (#332, UX §4). */
export function FilterSheet({
  filters,
  setFilters,
  reset,
  showCompare,
  mentions,
  queryItems,
  queryNames,
}: FilterSheetProps) {
  const n = activeFilterCount(filters);
  const summary = [
    filters.preset === "custom" ? null : PRESET_LABEL[filters.preset],
    rangeLabel(filters),
    n > 0 ? `${n} bộ lọc` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex h-12 items-center justify-between gap-3 px-4">
      <p className="min-w-0 truncate text-sm text-[var(--ink)]" suppressHydrationWarning>
        {summary}
      </p>
      <SlideoutMenu.Trigger>
        <AriaButton
          aria-label={`Bộ lọc, ${n} đang áp dụng`}
          className="plaque-button inline-flex min-h-11 shrink-0 items-center px-4 text-sm outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Bộ lọc
        </AriaButton>
        <SlideoutMenu
          isDismissable
          className="z-50 items-end justify-center pl-0 md:pl-0"
          // Bottom sheet: full width, max 85dvh, rounded top.
          dialogClassName="h-auto max-h-[85dvh] gap-0 rounded-t-xl"
        >
          {({ close }) => (
            <>
              <SlideoutMenu.Header onClose={close} className="pb-3">
                <h2 className="text-md font-semibold text-primary">Bộ lọc</h2>
              </SlideoutMenu.Header>
              <SlideoutMenu.Content role="group" aria-label="Các bộ lọc" className="gap-4 pb-4">
                <TimePresets filters={filters} setFilters={setFilters} />
                <DateRangeControl filters={filters} setFilters={setFilters} />
                <QueryFilter filters={filters} setFilters={setFilters} items={queryItems} className="w-full" />
                <RelevanceFilter filters={filters} setFilters={setFilters} className="w-full" />
                <SecondaryFilters filters={filters} setFilters={setFilters} itemClassName="w-full" />
                {showCompare && <CompareToggle filters={filters} setFilters={setFilters} />}
                <AppliedFilterChips
                  filters={filters}
                  setFilters={setFilters}
                  queryNames={queryNames}
                  mentions={mentions}
                />
              </SlideoutMenu.Content>
              <SlideoutMenu.Footer className="flex justify-end gap-3">
                {!isDefaultFilters(filters) && (
                  <Button size="sm" color="secondary" onClick={reset}>
                    Đặt lại
                  </Button>
                )}
                <Button size="sm" onClick={close}>
                  Xong
                </Button>
              </SlideoutMenu.Footer>
            </>
          )}
        </SlideoutMenu>
      </SlideoutMenu.Trigger>
    </div>
  );
}
