"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toCsv, downloadFile } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { EmptyState, ErrorState, Skeleton } from "./display";
import { Checkbox, Input } from "./form-controls";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "./overlays";

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** Placeholder for the search box; omit to hide search. */
  searchPlaceholder?: string;
  /** Extra controls (filter selects) shown next to search. */
  toolbar?: ReactNode;
  /** Enables row checkboxes; receives the selected rows to render bulk actions. */
  bulkActions?: (rows: T[], clear: () => void) => ReactNode;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
  /** File name for the CSV export button; omit to hide the button. */
  exportName?: string;
  empty?: { title: string; description?: string; action?: ReactNode };
  pageSize?: number;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  isError,
  onRetry,
  searchPlaceholder,
  toolbar,
  bulkActions,
  onRowClick,
  getRowId,
  exportName,
  empty = { title: "Nothing here yet" },
  pageSize = 20,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const allColumns = useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!bulkActions) return columns;
    const select: ColumnDef<T, unknown> = {
      id: "_select",
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all rows on this page"
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(v === true)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(v === true)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    };
    return [select, ...columns];
  }, [columns, bulkActions]);

  const table = useReactTable({
    data: data ?? [],
    columns: allColumns,
    state: { sorting, globalFilter, rowSelection, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide());

  function exportCsv() {
    const cols = table
      .getVisibleLeafColumns()
      .filter((c) => c.id !== "_select" && c.columnDef.meta?.csv !== false);
    const header = cols.map((c) => (typeof c.columnDef.header === "string" ? c.columnDef.header : c.id));
    const rows = table.getFilteredRowModel().rows.map((r) =>
      cols.map((c) => {
        const v = c.columnDef.meta?.csvValue ? c.columnDef.meta.csvValue(r.original) : r.getValue(c.id);
        return v === null || v === undefined ? "" : String(v);
      }),
    );
    downloadFile(
      `${exportName}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(header, rows),
      "text/csv",
    );
  }

  // "/" jumps to the search box, Escape clears it (skipped while typing elsewhere).
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!searchPlaceholder) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchPlaceholder]);

  return (
    <div className="grid gap-4">
      {searchPlaceholder || toolbar || exportName || hideable.length > 0 ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {searchPlaceholder ? (
            <div className="relative lg:w-80">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                ref={searchRef}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && globalFilter) {
                    e.stopPropagation();
                    setGlobalFilter("");
                  }
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                aria-keyshortcuts="/"
                className="h-11 pr-10 pl-10"
              />
              <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-border px-1.5 text-xs text-muted-foreground lg:block">
                /
              </kbd>
            </div>
          ) : null}
          {toolbar ? <div className="flex flex-wrap gap-2">{toolbar}</div> : null}
          <div className="flex gap-2 lg:ml-auto">
            {hideable.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="md">
                    <SlidersHorizontal /> Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                  {hideable.map((c) => (
                    <label
                      key={c.id}
                      className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-[15px] hover:bg-surface-muted"
                    >
                      <Checkbox
                        checked={c.getIsVisible()}
                        onCheckedChange={(v) => c.toggleVisibility(v === true)}
                      />
                      {typeof c.columnDef.header === "string" ? c.columnDef.header : c.id}
                    </label>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {exportName ? (
              <Button variant="outline" onClick={exportCsv} disabled={!data?.length}>
                <Download /> Export CSV
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {bulkActions && selected.length > 0 ? (
        <div
          className="flex animate-fade-up flex-wrap items-center gap-3 rounded-lg bg-secondary px-4 py-3 text-secondary-foreground"
          role="region"
          aria-label="Bulk actions"
        >
          <span className="text-sm font-semibold">{selected.length} selected</span>
          <div className="flex flex-wrap gap-2">{bulkActions(selected, () => setRowSelection({}))}</div>
          <button
            className="ml-auto text-sm font-semibold underline-offset-4 hover:underline"
            onClick={() => setRowSelection({})}
          >
            Clear
          </button>
        </div>
      ) : null}

      {isError ? (
        <ErrorState onRetry={onRetry} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
              <thead className="bg-surface-muted/60">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => {
                      const sort = h.column.getIsSorted();
                      return (
                        <th
                          key={h.id}
                          scope="col"
                          aria-sort={
                            sort === "asc" ? "ascending" : sort === "desc" ? "descending" : undefined
                          }
                          className={cn(
                            "h-11 px-4 text-[13px] font-semibold whitespace-nowrap text-muted-foreground",
                            h.column.id === "_select" && "w-12",
                          )}
                        >
                          {h.isPlaceholder ? null : h.column.getCanSort() ? (
                            <button
                              className="-mx-1 inline-flex cursor-pointer items-center gap-1 rounded px-1 hover:text-foreground"
                              onClick={h.column.getToggleSortingHandler()}
                            >
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              {sort === "asc" ? (
                                <ArrowUp className="size-3.5" />
                              ) : sort === "desc" ? (
                                <ArrowDown className="size-3.5" />
                              ) : (
                                <ChevronsUpDown className="size-3.5 opacity-50" />
                              )}
                            </button>
                          ) : (
                            flexRender(h.column.columnDef.header, h.getContext())
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 6 }, (_, i) => (
                      <tr key={i} className="border-t border-border">
                        {table.getVisibleLeafColumns().map((c) => (
                          <td key={c.id} className="h-14 px-4">
                            <Skeleton className="h-4 w-full max-w-36" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                        onKeyDown={
                          onRowClick
                            ? (e) => (e.key === "Enter" ? onRowClick(row.original) : undefined)
                            : undefined
                        }
                        tabIndex={onRowClick ? 0 : undefined}
                        data-selected={row.getIsSelected() || undefined}
                        className={cn(
                          "border-t border-border transition-colors data-[selected]:bg-primary-soft/40",
                          onRowClick && "cursor-pointer hover:bg-surface-muted/60",
                        )}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="h-14 px-4 align-middle">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {!isLoading && table.getRowModel().rows.length === 0 ? (
            <EmptyState
              className="rounded-none border-0"
              title={globalFilter ? "No matches" : empty.title}
              description={globalFilter ? "Try a different search or clear the filters." : empty.description}
              action={globalFilter ? undefined : empty.action}
            />
          ) : null}
          {table.getPageCount() > 1 ? (
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
              <span>
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()},{" "}
                {table.getFilteredRowModel().rows.length} rows
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Previous page"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Next page"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Set false to leave this column out of CSV exports. */
    csv?: boolean;
    /** Plain-text value for CSV when the cell renders JSX. */
    csvValue?: (row: TData) => string | number | null | undefined;
  }
}
