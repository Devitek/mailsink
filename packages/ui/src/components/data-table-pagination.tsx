import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Button } from './button'

// Pager of a DataTable with server pagination: a summary (« 51-100 of 312 », given by the
// caller), the page size, previous and next. Works for page numbers and keyset cursors
// alike: the caller says whether each direction is possible. Labels come translated.

export interface DataTablePaginationProps {
  summary: ReactNode
  canPrevious: boolean
  canNext: boolean
  onPrevious: () => void
  onNext: () => void
  pageSize: number
  pageSizes: readonly number[]
  onPageSize: (size: number) => void
  labels: { previous: string; next: string; pageSize: string; navigation: string }
  className?: string
}

export function DataTablePagination({
  summary,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  pageSize,
  pageSizes,
  onPageSize,
  labels,
  className,
}: Readonly<DataTablePaginationProps>) {
  return (
    <nav
      aria-label={labels.navigation}
      data-slot="data-table-pagination"
      className={cn(
        'flex flex-wrap items-center gap-3 border-t border-ms-border bg-ms-panel px-6 py-2.5 text-xs text-ms-text-muted',
        className,
      )}
    >
      <span className="font-mono">{summary}</span>
      <span className="flex-1" />
      <label className="flex items-center gap-2">
        {labels.pageSize}
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="h-control-sm cursor-pointer rounded-sm border border-ms-border-strong bg-ms-bg px-2 font-mono text-xs text-ms-text outline-none focus-visible:focus-ring"
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <Button variant="outline" size="sm" disabled={!canPrevious} onClick={onPrevious}>
        <span aria-hidden>←</span>
        {labels.previous}
      </Button>
      <Button variant="outline" size="sm" disabled={!canNext} onClick={onNext}>
        {labels.next}
        <span aria-hidden>→</span>
      </Button>
    </nav>
  )
}
