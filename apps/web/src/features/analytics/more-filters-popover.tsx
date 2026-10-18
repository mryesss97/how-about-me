"use client";

import { plaqueClassName } from "@/features/shared/plaque-button";
import {
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  Popover as AriaPopover,
} from "react-aria-components";
import { Button as AriaButton } from "react-aria-components";
import { secondaryFilterCount } from "@/lib/filters";
import { SecondaryFilters } from "./filter-controls";
import type { FilterControlProps } from "./time-controls";

/** "Bộ lọc khác (n)" — secondary filters in a popover, applied live (UX §2.1, #332). */
export function MoreFiltersPopover({ filters, setFilters }: FilterControlProps) {
  const n = secondaryFilterCount(filters);
  return (
    <AriaDialogTrigger>
      <AriaButton className={plaqueClassName("sm", "text-sm")}>Bộ lọc khác{n > 0 ? ` (${n})` : ""}</AriaButton>
      <AriaPopover
        placement="bottom start"
        offset={6}
        className="w-[min(36rem,calc(100vw-2rem))] rounded-lg bg-primary p-4 shadow-lg ring-1 ring-secondary_alt outline-hidden"
      >
        <AriaDialog aria-label="Bộ lọc khác" className="grid grid-cols-2 gap-3 outline-hidden">
          <SecondaryFilters filters={filters} setFilters={setFilters} itemClassName="w-full" />
        </AriaDialog>
      </AriaPopover>
    </AriaDialogTrigger>
  );
}
