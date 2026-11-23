import {
  type ColumnDef,
  createColumnHelper,
  type RowData,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '../lib/cn'

// Generic DataTable on TanStack Table (headless) with the prototype log table measures:
// 34 px sticky header in 11 px uppercase faint labels, 38 px mono rows separated by a
// border, hover and selected fills. Sorting, filtering and pagination are server side: the
// table renders the page it is given and reports sort changes. No text of its own.

export const dataTableFeatures = tableFeatures({ rowSortingFeature })
export type DataTableFeatures = typeof dataTableFeatures
// biome-ignore lint/suspicious/noExplicitAny: column values are heterogeneous, as in TanStack's own ColumnDef[] examples.
export type DataTableColumn<TData extends RowData> = ColumnDef<DataTableFeatures, TData, any>
export type DataTableSorting = SortingState

/** Column helper bound to the DataTable features. */
export const dataTableColumns = <TData extends RowData>() =>
  createColumnHelper<DataTableFeatures, TData>()

export interface DataTableProps<TData extends RowData> {
  columns: DataTableColumn<TData>[]
  data: TData[]
  getRowId: (row: TData) => string
  /** Width of each column by id (CSS length); columns without one share the rest. */
  widths?: Record<string, string>
  /** Accessible name of the table, translated by the caller. */
  label: string
  /** Server-side sort: the table shows it and reports header clicks (descending first). */
  sorting?: DataTableSorting
  onSortingChange?: (sorting: DataTableSorting) => void
  selectedRowId?: string
  onRowClick?: (row: TData) => void
  /** Shown in place of the rows when the page is empty. */
  empty?: ReactNode
  /** Dims the rows while the next page loads. */
  pending?: boolean
  className?: string
}

const SORT_ICON = { asc: '↑', desc: '↓' } as const

export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  widths = {},
  label,
  sorting = [],
  onSortingChange,
  selectedRowId,
  onRowClick,
  empty,
  pending = false,
  className,
}: Readonly<DataTableProps<TData>>) {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: (row) => getRowId(row),
    manualSorting: true,
    sortDescFirst: true,
    enableSortingRemoval: false,
    defaultColumn: { enableSorting: false },
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      onSortingChange?.(next)
    },
  })
  const rows = table.getRowModel().rows
  const onKey = (event: KeyboardEvent, row: TData) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onRowClick?.(row)
  }

  return (
    <table
      aria-label={label}
      data-slot="data-table"
      className={cn('w-full table-fixed border-collapse font-mono text-xs', className)}
    >
      <colgroup>
        {table.getAllLeafColumns().map((column) => (
          <col key={column.id} style={{ width: widths[column.id] }} />
        ))}
      </colgroup>
      <thead className="sticky top-0 z-[1] bg-ms-bg">
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id} className="h-[34px] border-b border-ms-border">
            {group.headers.map((header) => {
              const sorted = header.column.getIsSorted()
              const canSort = header.column.getCanSort() && onSortingChange
              const sortLabel = sorted ? SORT_ICON[sorted] : null
              return (
                <th
                  key={header.id}
                  scope="col"
                  aria-sort={
                    sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined
                  }
                  className="px-2 text-left font-sans text-label font-medium tracking-[0.06em] whitespace-nowrap text-ms-text-faint uppercase first:pl-6 last:pr-6 last:text-right"
                >
                  {header.isPlaceholder ? null : canSort ? (
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="inline-flex cursor-pointer items-center gap-1 uppercase outline-none hover:text-ms-text focus-visible:focus-ring"
                    >
                      <table.FlexRender header={header} />
                      <span aria-hidden className="w-2.5 text-ms-text-muted">
                        {sortLabel}
                      </span>
                    </button>
                  ) : (
                    <table.FlexRender header={header} />
                  )}
                </th>
              )
            })}
          </tr>
        ))}
      </thead>
      <tbody className={cn(pending && 'opacity-60')}>
        {rows.length === 0 && empty ? (
          <tr>
            <td colSpan={columns.length} className="px-6 py-12 text-center font-sans">
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr
              key={row.id}
              tabIndex={onRowClick ? 0 : undefined}
              aria-current={row.id === selectedRowId ? 'true' : undefined}
              data-state={row.id === selectedRowId ? 'selected' : undefined}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              onKeyDown={onRowClick ? (e) => onKey(e, row.original) : undefined}
              className={cn(
                'h-[38px] border-b border-ms-border outline-none transition-colors duration-fast ease-ms focus-visible:bg-ms-hover',
                onRowClick && 'cursor-pointer hover:bg-ms-hover',
                row.id === selectedRowId && 'bg-ms-hover',
              )}
            >
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="truncate px-2 first:pl-6 last:pr-6 last:text-right">
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}
