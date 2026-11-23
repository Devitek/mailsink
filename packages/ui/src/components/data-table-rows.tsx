import type { Row, RowData } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '../lib/cn'
import type { DataTableFeatures } from './data-table'

// Body rows of the DataTable: every row, or (`virtual`, beyond `threshold` rows) only the
// rows in view plus an overscan, between two spacer rows that keep the scroll height
// (rows are a fixed 38 px, so no measuring).

export const ROW_HEIGHT = 38

export interface DataTableVirtual {
  /** The scrolling ancestor of the table. */
  getScrollElement: () => HTMLElement | null
  /** Rows rendered all at once up to this count (default 200). */
  threshold?: number
}

export interface DataTableRowsProps<TData extends RowData> {
  rows: Row<DataTableFeatures, TData>[]
  columnCount: number
  renderCells: (row: Row<DataTableFeatures, TData>) => ReactNode
  selectedRowId?: string
  onRowClick?: (row: TData) => void
  rowLabel?: (row: TData) => string
  virtual?: DataTableVirtual
}

function Spacer({ height, columns }: Readonly<{ height: number; columns: number }>) {
  if (height <= 0) return null
  return (
    <tr aria-hidden style={{ height }}>
      <td colSpan={columns} />
    </tr>
  )
}

export function DataTableRows<TData extends RowData>({
  rows,
  columnCount,
  renderCells,
  selectedRowId,
  onRowClick,
  rowLabel,
  virtual,
}: Readonly<DataTableRowsProps<TData>>) {
  const on = virtual !== undefined && rows.length > (virtual.threshold ?? 200)
  const virtualizer = useVirtualizer({
    count: on ? rows.length : 0,
    getScrollElement: () => virtual?.getScrollElement() ?? null,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    // The server renders the first screen of rows too.
    initialRect: { width: 800, height: 900 },
  })
  const items = on ? virtualizer.getVirtualItems() : null
  const shown = items ? items.map((item) => rows[item.index]).filter((r) => r !== undefined) : rows
  const before = items?.[0]?.start ?? 0
  const after = items ? virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0) : 0

  const onKey = (event: KeyboardEvent, row: TData) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onRowClick?.(row)
  }
  return (
    <>
      <Spacer height={before} columns={columnCount} />
      {shown.map((row) => (
        <tr
          key={row.id}
          tabIndex={onRowClick ? 0 : undefined}
          aria-label={rowLabel?.(row.original)}
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
          {renderCells(row)}
        </tr>
      ))}
      <Spacer height={after} columns={columnCount} />
    </>
  )
}
