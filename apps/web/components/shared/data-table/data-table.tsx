"use client";

import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import type { DataTableColumn, SortState } from "./columns";
import { ColumnVisibility } from "./column-visibility";

const VIRTUALIZE_THRESHOLD = 500;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export interface DataTableProps<TRow> {
  columns: readonly DataTableColumn<TRow>[];
  rows: TRow[];
  /** Total row count (for server-side pagination). Defaults to rows.length. */
  total?: number;
  loading?: boolean;
  /** Stable row id for keys + selection. */
  getRowId: (row: TRow) => string;

  // State (managed by useTableState typically)
  hiddenCols: Set<string>;
  sort: SortState | null;
  onToggleSort: (id: string) => void;
  onToggleColumn: (id: string) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;

  // Optional surfaces
  toolbar?: React.ReactNode;
  /** Slot rendered above the table — e.g. SavedViews / filters. */
  topRight?: React.ReactNode;
  /** Slot rendered between toolbar and table — sliding bulk action bar. */
  bulkBar?: React.ReactNode;
  /** Optional row selection. If provided, leftmost checkbox column appears. */
  selection?: {
    selected: Set<string>;
    onToggleRow: (id: string) => void;
    onToggleAll: () => void;
  };

  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<TRow>({
  columns,
  rows,
  total,
  loading,
  getRowId,
  hiddenCols,
  sort,
  onToggleSort,
  onToggleColumn,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  toolbar,
  topRight,
  bulkBar,
  selection,
  emptyTitle = "Gösterilecek kayıt yok",
  emptyDescription,
}: DataTableProps<TRow>) {
  const visibleCols = useMemo(
    () => columns.filter((c) => !hiddenCols.has(c.id)),
    [columns, hiddenCols]
  );

  const rowCount = total ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(rowCount / pageSize));
  const fromIdx = (page - 1) * pageSize + 1;
  const toIdx = Math.min(page * pageSize, rowCount);

  const useVirtual = rows.length > VIRTUALIZE_THRESHOLD;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 12,
    enabled: useVirtual,
  });

  return (
    <div className="space-y-3">
      {(toolbar || topRight) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 min-w-0">{toolbar}</div>
          <div className="flex items-center gap-2 shrink-0">
            {topRight}
            <ColumnVisibility
              columns={columns}
              hidden={hiddenCols}
              onToggle={onToggleColumn}
            />
          </div>
        </div>
      )}

      {bulkBar}

      <div
        ref={scrollRef}
        className={cn(
          "rounded-lg border border-border bg-card overflow-auto",
          useVirtual && "max-h-[70vh]"
        )}
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              {selection && (
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Tümünü seç"
                    checked={
                      rows.length > 0 &&
                      rows.every((r) => selection.selected.has(getRowId(r)))
                    }
                    onChange={() => selection.onToggleAll()}
                    className="size-4 accent-primary"
                  />
                </TableHead>
              )}
              {visibleCols.map((col) => (
                <TableHead
                  key={col.id}
                  className={cn(col.className, col.sortable && "cursor-pointer select-none")}
                  onClick={col.sortable ? () => onToggleSort(col.id) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable &&
                      (sort?.id === col.id ? (
                        sort.dir === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                      ))}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell colSpan={visibleCols.length + (selection ? 1 : 0)}>
                    <div className="h-6 bg-muted/50 rounded animate-pulse" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleCols.length + (selection ? 1 : 0)} className="p-0">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </TableCell>
              </TableRow>
            ) : useVirtual ? (
              (() => {
                const items = virtualizer.getVirtualItems();
                return (
                  <>
                    {items[0] && items[0].start > 0 && (
                      <tr style={{ height: items[0].start }}>
                        <td colSpan={visibleCols.length + (selection ? 1 : 0)} />
                      </tr>
                    )}
                    {items.map((vi) => {
                      const row = rows[vi.index];
                      const id = getRowId(row);
                      const checked = selection?.selected.has(id);
                      return (
                        <TableRow key={id} data-state={checked ? "selected" : undefined}>
                          {selection && (
                            <TableCell>
                              <input
                                type="checkbox"
                                aria-label="Satırı seç"
                                checked={!!checked}
                                onChange={() => selection.onToggleRow(id)}
                                className="size-4 accent-primary"
                              />
                            </TableCell>
                          )}
                          {visibleCols.map((col) => (
                            <TableCell key={col.id} className={col.className}>
                              {col.cell
                                ? col.cell(row)
                                : String(
                                    (col.accessor
                                      ? col.accessor(row)
                                      : (row as Record<string, unknown>)[col.id]) ?? ""
                                  )}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                    {items.length > 0 &&
                      virtualizer.getTotalSize() > items[items.length - 1].end && (
                        <tr
                          style={{
                            height: virtualizer.getTotalSize() - items[items.length - 1].end,
                          }}
                        >
                          <td colSpan={visibleCols.length + (selection ? 1 : 0)} />
                        </tr>
                      )}
                  </>
                );
              })()
            ) : (
              rows.map((row) => {
                const id = getRowId(row);
                const checked = selection?.selected.has(id);
                return (
                  <TableRow key={id} data-state={checked ? "selected" : undefined}>
                    {selection && (
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label="Satırı seç"
                          checked={!!checked}
                          onChange={() => selection.onToggleRow(id)}
                          className="size-4 accent-primary"
                        />
                      </TableCell>
                    )}
                    {visibleCols.map((col) => (
                      <TableCell key={col.id} className={col.className}>
                        {col.cell
                          ? col.cell(row)
                          : String(
                              (col.accessor
                                ? col.accessor(row)
                                : (row as Record<string, unknown>)[col.id]) ?? ""
                            )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer: pagination + page size */}
      {rowCount > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm">
          <div className="text-muted-foreground">
            {fromIdx}–{toIdx} / {rowCount} kayıt
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Sayfa boyutu</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                aria-label="Önceki sayfa"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs tabular-nums px-2 text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                aria-label="Sonraki sayfa"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
