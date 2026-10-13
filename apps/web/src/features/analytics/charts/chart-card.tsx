"use client";

import { type ReactNode, useState } from "react";
import { ToggleButton as AriaToggleButton } from "react-aria-components";
import { Table } from "@/components/application/table/table";
import { QueryState, type QueryStateError } from "@/features/shared/query-state";
import { cx } from "@/utils/cx";

/** Tabular twin of a chart (NFR-032): first column is the row header, the rest are pre-formatted cells. */
export type ChartTable = { columns: readonly string[]; rows: ReadonlyArray<readonly string[]> };

export type ChartCardProps = {
  title: string;
  description?: string;
  isLoading?: boolean;
  error?: QueryStateError | null;
  onRetry?: () => void;
  /** No data in range — an explicit empty state, never a blank chart (BR-032). */
  isEmpty?: boolean;
  emptyTitle?: string;
  table: ChartTable;
  className?: string;
  children: ReactNode;
};

export function ChartSkeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("h-72 w-full animate-pulse rounded-lg bg-secondary", className)} />;
}

/** Card shell shared by overview charts (T-100, reused by T-101): title, "View as table" toggle, states. */
export function ChartCard({
  title,
  description,
  isLoading,
  error,
  onRetry,
  isEmpty,
  emptyTitle = "No mentions in this range",
  table,
  className,
  children,
}: ChartCardProps) {
  const [asTable, setAsTable] = useState(false);
  const ready = !isLoading && !error && !isEmpty;

  return (
    <section className={cx("flex flex-col gap-4 rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary", className)}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-md font-semibold text-primary">{title}</h3>
          {description ? <p className="text-sm text-tertiary">{description}</p> : null}
        </div>
        {ready ? (
          <AriaToggleButton
            isSelected={asTable}
            onChange={setAsTable}
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-secondary shadow-xs ring-1 ring-primary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2 selected:bg-active"
          >
            View as table
          </AriaToggleButton>
        ) : null}
      </header>
      <QueryState
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        isEmpty={isEmpty}
        emptyTitle={emptyTitle}
        skeleton={<ChartSkeleton />}
      >
        {asTable ? (
          // Long ranges (up to 744 hourly buckets) scroll inside the card instead of stretching the page.
          <div className="max-h-80 overflow-y-auto">
            <ChartDataTable caption={title} table={table} />
          </div>
        ) : (
          children
        )}
      </QueryState>
    </section>
  );
}

function ChartDataTable({ caption, table }: { caption: string; table: ChartTable }) {
  return (
    <Table aria-label={`${caption} (table)`} size="sm">
      <Table.Header>
        {table.columns.map((c, i) => (
          <Table.Head key={c} id={c} label={c} isRowHeader={i === 0} />
        ))}
      </Table.Header>
      <Table.Body>
        {table.rows.map((row, r) => (
          <Table.Row key={r} id={r}>
            {row.map((cell, c) => (
              <Table.Cell key={c}>{cell}</Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
