"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import {
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

import { cn } from "@/registry/vianova/lib/utils";

/**
 * Feature set, declared once at module scope.
 *
 * v9 registers features explicitly instead of shipping them all: only sorting
 * and column visibility are paid for here. It must be module-level and stable —
 * rebuilding it per render rebuilds the table instance and loses all state.
 */
export const dataGridFeatures = tableFeatures({
  rowSortingFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    datetime: sortFn_datetime,
    basic: sortFn_basic,
  },
});

export type DataGridFeatures = typeof dataGridFeatures;

/** Column helper bound to the grid's feature set. */
export function createDataGridColumns<TData extends RowData>() {
  return createColumnHelper<DataGridFeatures, TData>();
}

export type DataGridColumn<TData extends RowData> = ColumnDef<DataGridFeatures, TData, unknown>;

/**
 * Per-column width, carried on `meta`.
 *
 * Not `size`: that belongs to columnSizingFeature, which this grid does not
 * register because nothing here resizes columns interactively. Paying for the
 * whole feature to hold one static number would be the wrong trade.
 */
export type DataGridColumnMeta = { width?: string };

/**
 * Virtualised, sortable data grid.
 *
 * Rendered as ARIA grid roles on divs rather than a `<table>`. Virtualisation
 * needs absolutely positioned rows, and a `<tbody>` whose rows are taken out of
 * flow stops being a table to both the layout engine and the accessibility
 * tree. Divs plus explicit roles keep the semantics honest.
 *
 * Because only a window of rows is ever in the DOM, `aria-rowcount` reports the
 * real total and every row carries its true `aria-rowindex`. Without those, a
 * screen reader announces "row 3 of 12" on a grid of 50,000.
 */
export function DataGrid<TData extends RowData>({
  data,
  columns,
  getRowId,
  height = 480,
  rowHeight = 40,
  columnVisibility,
  onColumnVisibilityChange,
  onRowClick,
  emptyState,
  caption,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onSelect"> & {
  data: TData[];
  columns: DataGridColumn<TData>[];
  getRowId?: (row: TData, index: number) => string;
  /** Viewport height in px. The grid scrolls internally; the page does not. */
  height?: number;
  rowHeight?: number;
  columnVisibility?: Record<string, boolean>;
  onColumnVisibilityChange?: (next: Record<string, boolean>) => void;
  onRowClick?: (row: TData) => void;
  emptyState?: React.ReactNode;
  /** Names the grid for assistive tech. Strongly recommended. */
  caption?: string;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const table = useTable({
    features: dataGridFeatures,
    data,
    columns,
    getRowId,
    state: columnVisibility ? { columnVisibility } : undefined,
    onColumnVisibilityChange: onColumnVisibilityChange
      ? (updater) =>
          onColumnVisibilityChange(
            typeof updater === "function" ? updater(columnVisibility ?? {}) : updater,
          )
      : undefined,
  });

  const rows = table.getRowModel().rows;
  const leafColumns = table.getVisibleLeafColumns();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    getItemKey: (index) => rows[index]!.id,
    overscan: 8,
  });

  // One grid-template shared by the header and every row, so columns cannot
  // drift apart the way they do when each row lays itself out.
  const template = leafColumns
    .map(
      (c) =>
        (c.columnDef.meta as DataGridColumnMeta | undefined)?.width ?? "minmax(8rem, 1fr)",
    )
    .join(" ");

  const items = virtualizer.getVirtualItems();

  return (
    <div
      data-slot="data-grid"
      className={cn("bg-card overflow-hidden rounded-lg border", className)}
      {...props}
    >
      <div
        ref={scrollRef}
        style={{ height }}
        className="relative overflow-auto"
        role="grid"
        aria-label={caption}
        aria-rowcount={rows.length + 1}
        aria-colcount={leafColumns.length}
      >
        <div
          role="rowgroup"
          className="bg-card sticky top-0 z-10 border-b"
        >
          {table.getHeaderGroups().map((group) => (
            <div
              key={group.id}
              role="row"
              aria-rowindex={1}
              className="grid items-center"
              style={{ gridTemplateColumns: template }}
            >
              {group.headers.map((header, i) => {
                const sorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                return (
                  <div
                    key={header.id}
                    role="columnheader"
                    aria-colindex={i + 1}
                    aria-sort={
                      !canSort
                        ? undefined
                        : sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : "none"
                    }
                    className="text-muted-foreground truncate px-3 py-2 text-xs font-medium"
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="hover:text-foreground focus-visible:ring-ring -mx-1 flex w-full items-center gap-1 rounded px-1 py-0.5 focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <span className="truncate"><table.FlexRender header={header} /></span>
                        {sorted === "asc" ? (
                          <ArrowUp aria-hidden className="size-3 shrink-0" />
                        ) : sorted === "desc" ? (
                          <ArrowDown aria-hidden className="size-3 shrink-0" />
                        ) : (
                          <ChevronsUpDown aria-hidden className="size-3 shrink-0 opacity-40" />
                        )}
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="text-muted-foreground p-8 text-center text-sm">
            {emptyState ?? "No rows match the current filter."}
          </div>
        ) : (
          <div
            role="rowgroup"
            style={{ height: virtualizer.getTotalSize() }}
            className="relative w-full"
          >
            {items.map((item) => {
              const row = rows[item.index]!;
              return (
                <div
                  key={row.id}
                  role="row"
                  // +2: aria-rowindex is 1-based and the header occupies row 1.
                  aria-rowindex={item.index + 2}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  style={{
                    transform: `translateY(${item.start}px)`,
                    gridTemplateColumns: template,
                  }}
                  className={cn(
                    "absolute top-0 left-0 grid w-full items-center border-b",
                    "hover:bg-muted/50 transition-colors",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {row.getVisibleCells().map((cell, i) => (
                    <div
                      key={cell.id}
                      role="gridcell"
                      aria-colindex={i + 1}
                      style={{ height: rowHeight }}
                      className="flex min-w-0 items-center truncate px-3 text-sm"
                    >
                      <table.FlexRender cell={cell} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
