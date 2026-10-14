"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { ToggleButton as AriaToggleButton } from "react-aria-components";
import { Table } from "@/components/application/table/table";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { QueryState, type QueryStateError } from "@/features/shared/query-state";
import { cx } from "@/utils/cx";

/** Tabular twin of a chart (NFR-032): first column is the row header, the rest are pre-formatted cells. */
export type ChartTable = {
  columns: readonly string[];
  rows: ReadonlyArray<readonly string[]>;
  /** FR-142: drill-down href per row (same index as `rows`); null/missing = plain text. Keyboard path to drill-down. */
  rowHrefs?: ReadonlyArray<string | null | undefined>;
};

/** FR-142 drill-down wiring passed by /overview: href per segment key (null = not drillable) + navigation. */
export type DrillDownProps<K extends string> = {
  getHref?: (key: K) => string | null;
  onNavigate?: (href: string) => void;
};

/** Zero-count segments are not drillable (empty list adds nothing). */
export function segmentHref<K extends string>(getHref: DrillDownProps<K>["getHref"], row: { key: K; count: number }) {
  return row.count > 0 ? (getHref?.(row.key) ?? null) : null;
}

/** Bar/slice click handler built from DrillDownProps; undefined when drill-down is off. */
export function drillSelect<K extends string>({ getHref, onNavigate }: DrillDownProps<K>) {
  if (!getHref || !onNavigate) return undefined;
  return {
    canSelect: (row: { key: K; count: number }) => segmentHref(getHref, row) !== null,
    select: (row: { key: K; count: number }) => {
      const href = segmentHref(getHref, row);
      if (href) onNavigate(href);
    },
  };
}

export type ChartCardProps = {
  title: string;
  description?: string;
  isLoading?: boolean;
  error?: QueryStateError | null;
  onRetry?: () => void;
  /** No data in range — an explicit empty state, never a blank chart (BR-032). */
  isEmpty?: boolean;
  emptyTitle?: string;
  /** #243: optional empty-state description (QueryState default otherwise). */
  emptyDescription?: string;
  table: ChartTable;
  className?: string;
  /** #222: segmented "chart | table" toggle labels instead of the "Xem dạng bảng" plaque. */
  viewToggle?: { chart: string; table: string };
  /** #222: controls shown above the content in both chart and table mode (only when ready). */
  toolbar?: ReactNode;
  /** #243: header control shown in every state (loading/empty/error too), e.g. a mode switch the user must reach to leave an empty state. */
  headerAction?: ReactNode;
  /** #222: content below the chart/table (only when ready). */
  footer?: ReactNode;
  children: ReactNode;
};

export function ChartSkeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("h-72 w-full animate-pulse rounded-lg bg-secondary", className)} />;
}

/** Card shell shared by overview charts (T-100, reused by T-101): title, "Xem dạng bảng" toggle, states.
 * Restyled as a white enamel board with a navy keyline (#275, DESIGN.md Operate Surfaces). */
export function ChartCard({
  title,
  description,
  isLoading,
  error,
  onRetry,
  isEmpty,
  emptyTitle = "Không có lượt nhắc trong khoảng này",
  emptyDescription,
  table,
  className,
  viewToggle,
  toolbar,
  headerAction,
  footer,
  children,
}: ChartCardProps) {
  const [asTable, setAsTable] = useState(false);
  const ready = !isLoading && !error && !isEmpty;

  return (
    <section className={cx("operate-board flex flex-col gap-4 p-5", className)}>
      <span aria-hidden className="sign-keyline" />
      <header className="relative flex items-start justify-between gap-3">
        <div>
          <h3 className="operate-board-title">{title}</h3>
          {description ? <p className="text-sm text-tertiary">{description}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {headerAction}
          {ready && viewToggle ? (
            <ButtonGroup
              size="sm"
              aria-label="Chế độ xem"
              disallowEmptySelection
              selectedKeys={[asTable ? "table" : "chart"]}
              onSelectionChange={(keys) => setAsTable(keys.has("table"))}
              className="shrink-0"
            >
              <ButtonGroupItem id="chart">{viewToggle.chart}</ButtonGroupItem>
              <ButtonGroupItem id="table">{viewToggle.table}</ButtonGroupItem>
            </ButtonGroup>
          ) : ready ? (
            <AriaToggleButton
              isSelected={asTable}
              onChange={setAsTable}
              className="plaque-button shrink-0 px-3 py-1.5 outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Xem dạng bảng
            </AriaToggleButton>
          ) : null}
        </div>
      </header>
      {ready && toolbar ? toolbar : null}
      <QueryState
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        isEmpty={isEmpty}
        emptyTitle={emptyTitle}
        {...(emptyDescription ? { emptyDescription } : {})}
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
      {ready && footer ? footer : null}
    </section>
  );
}

function ChartDataTable({ caption, table }: { caption: string; table: ChartTable }) {
  return (
    <Table aria-label={`${caption} (bảng)`} size="sm">
      <Table.Header>
        {table.columns.map((c, i) => (
          <Table.Head key={c} id={c} label={c} isRowHeader={i === 0} />
        ))}
      </Table.Header>
      <Table.Body>
        {table.rows.map((row, r) => (
          <Table.Row key={r} id={r}>
            {row.map((cell, c) => (
              <Table.Cell key={c}>
                {c === 0 && table.rowHrefs?.[r] ? (
                  <Link
                    href={table.rowHrefs[r]}
                    className="font-medium text-brand-secondary underline-offset-2 outline-focus-ring hover:underline focus-visible:outline-2"
                  >
                    {cell}
                  </Link>
                ) : (
                  cell
                )}
              </Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
