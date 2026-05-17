import type { ReactNode } from "react";

/**
 * Column descriptor for `DataTable`. Generic over the row type.
 *
 * Set `accessor` for sortable plain values; use `cell` for custom rendering.
 * `id` should be stable — used for URL query state and localStorage.
 */
export interface DataTableColumn<TRow> {
  id: string;
  header: ReactNode;
  /** How to extract the raw sort/filter value. Defaults to `(row) => row[id]` if omitted. */
  accessor?: (row: TRow) => unknown;
  /** Custom cell renderer. Defaults to printing the accessor value. */
  cell?: (row: TRow) => ReactNode;
  /** Whether the column header is clickable to sort. */
  sortable?: boolean;
  /** Tailwind class on the <th> / <td>. */
  className?: string;
  /** Hide by default (user can toggle in column visibility menu). */
  hiddenByDefault?: boolean;
  /** Sticky right-side column (typically the actions column). */
  sticky?: "right";
}

export type SortDirection = "asc" | "desc";

export interface SortState {
  id: string;
  dir: SortDirection;
}
