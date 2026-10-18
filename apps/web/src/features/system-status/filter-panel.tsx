"use client";

import { RefreshCcw01 } from "@untitledui/icons";
import { useState, type ReactNode } from "react";
import { PlaqueButton, plaqueClassName } from "@/features/shared/plaque-button";

export const FIELD = "flex flex-col gap-1.5 text-sm font-medium text-secondary";
export const CONTROL =
  "min-w-0 rounded-lg bg-primary px-3 py-2 text-sm text-primary shadow-xs ring-1 ring-primary ring-inset outline-hidden focus-visible:ring-2 focus-visible:ring-brand";

type Props = {
  /** id of the collapsible field region (aria-controls). */
  fieldsId: string;
  /** Non-empty fields inside the panel → "Bộ lọc · n". */
  activeCount: number;
  onRefresh: () => void;
  isRefreshing: boolean;
  /** Optional row before "Làm mới" (quick status plaques). */
  quick?: ReactNode;
  /** Grid classes for the field region from `md` (fields are always 2 columns below `md`). */
  gridClassName: string;
  children: ReactNode;
};

/**
 * #343: System Status filter panel (DESIGN.md → Filter panel, "Bộ lọc · n" variant). White enamel panel with a 2px
 * navy rule; quick row + "Làm mới" always visible; the fields collapse under `md` behind an inline disclosure.
 */
export function FilterPanel({ fieldsId, activeCount, onRefresh, isRefreshing, quick, gridClassName, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3 border-b-2 border-[var(--ink)] bg-[var(--enamel-white)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Quick plaques wrap and take their own row under md, so none is clipped at 390 px (#343). */}
        {quick ? <div className="w-full min-w-0 md:w-auto md:flex-1">{quick}</div> : null}
        <button
          type="button"
          className={plaqueClassName("sm", "min-h-11 md:hidden")}
          aria-expanded={open}
          aria-controls={fieldsId}
          onClick={() => setOpen((o) => !o)}
        >
          Bộ lọc{activeCount > 0 ? ` · ${activeCount}` : ""}
        </button>
        <PlaqueButton
          className={`min-h-11 ${quick ? "" : "ml-auto"}`}
          iconLeading={RefreshCcw01}
          isLoading={isRefreshing}
          onClick={onRefresh}
        >
          Làm mới
        </PlaqueButton>
      </div>
      <div id={fieldsId} className={`${open ? "grid" : "hidden"} grid-cols-2 items-end gap-3 md:grid ${gridClassName}`}>
        {children}
      </div>
    </div>
  );
}

/** Calendar-day range (project tz); the two inputs sit side by side even at 390 px. */
export function DateRangeFields({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (patch: { from?: string; to?: string }) => void;
}) {
  return (
    <>
      <label className={FIELD}>
        Từ ngày
        <input
          type="date"
          className={CONTROL}
          value={from}
          max={to || undefined}
          onChange={(e) => onChange({ from: e.target.value })}
        />
      </label>
      <label className={FIELD}>
        Đến ngày
        <input
          type="date"
          className={CONTROL}
          value={to}
          min={from || undefined}
          onChange={(e) => onChange({ to: e.target.value })}
        />
      </label>
    </>
  );
}
