import {
  type ColumnDef,
  createColumnHelper,
  type RowData,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../lib/cn'
import { DataTableRows, type DataTableVirtual } from './data-table-rows'

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
  /**
   * Layout below the `md` breakpoint (768 px), applied in CSS so the server render already
   * fits a phone (no jump after hydration): columns left out and widths replacing `widths`.
   */
  narrow?: DataTableNarrow
  /** Accessible name of a row (the cells concatenated otherwise, cut by some browsers). */
  rowLabel?: (row: TData) => string
  /** Renders only the rows in view beyond a threshold (long client-side lists). */
  virtual?: DataTableVirtual
  className?: string
}

export interface DataTableNarrow {
  hiddenColumns?: readonly string[]
  widths?: Record<string, string>
}

type ColumnStyle = CSSProperties & Record<'--col-w' | '--col-w-narrow', string | undefined>

/**
 * Classes of the cells of a column: hidden on narrow screens, or padded and right aligned
 * when it is the last column shown (on wide screens, narrow screens or both).
 */
function columnClasses(ids: readonly string[], narrow: DataTableNarrow | undefined) {
  const hidden = new Set(narrow?.hiddenColumns)
  const lastWide = ids.at(-1)
  const lastNarrow = ids.filter((id) => !hidden.has(id)).at(-1)
  return (id: string) => {
    if (hidden.has(id)) return 'max-md:hidden'
    if (id === lastWide && id === lastNarrow) return 'pr-6 text-right'
    if (id === lastWide) return 'md:pr-6 md:text-right'
    if (id === lastNarrow) return 'max-md:pr-6 max-md:text-right'
    return undefined
  }
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
  narrow,
  rowLabel,
  virtual,
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
  const leafColumns = table.getAllLeafColumns()
  const edge = columnClasses(
    leafColumns.map((c) => c.id),
    narrow,
  )

  return (
    <table
      aria-label={label}
      data-slot="data-table"
      className={cn('w-full table-fixed border-collapse font-mono text-xs', className)}
    >
      <colgroup>
        {leafColumns.map((column) => {
          const style: ColumnStyle = {
            '--col-w': widths[column.id],
            '--col-w-narrow': narrow ? narrow.widths?.[column.id] : widths[column.id],
          }
          return (
            <col
              key={column.id}
              style={style}
              className={cn(
                'w-(--col-w) max-md:w-(--col-w-narrow)',
                narrow?.hiddenColumns?.includes(column.id) && 'max-md:hidden',
              )}
            />
          )
        })}
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
                  className={cn(
                    'px-2 text-left font-sans text-label font-medium tracking-[0.06em] whitespace-nowrap text-ms-text-faint uppercase first:pl-6',
                    edge(header.column.id),
                  )}
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
            <td colSpan={leafColumns.length} className="px-6 py-12 text-center font-sans">
              {empty}
            </td>
          </tr>
        ) : (
          <DataTableRows
            rows={rows}
            columnCount={leafColumns.length}
            selectedRowId={selectedRowId}
            onRowClick={onRowClick}
            rowLabel={rowLabel}
            virtual={virtual}
            renderCells={(row) =>
              row.getAllCells().map((cell) => (
                <td key={cell.id} className={cn('truncate px-2 first:pl-6', edge(cell.column.id))}>
                  <table.FlexRender cell={cell} />
                </td>
              ))
            }
          />
        )}
      </tbody>
    </table>
  )
}
