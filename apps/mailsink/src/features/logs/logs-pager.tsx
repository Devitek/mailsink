import { useLingui } from '@lingui/react/macro'
import type { LogsSearch } from '@mailsink/contracts'
import { DataTablePagination } from '@mailsink/ui'
import { rangeOf } from './format'
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from './search-query'

export type SetLogsSearch = (change: Partial<LogsSearch>, options?: { replace?: boolean }) => void

function usePagerLabels() {
  const { t } = useLingui()
  return {
    previous: t`Previous`,
    next: t`Next`,
    pageSize: t`Rows`,
    navigation: t`Pagination`,
  }
}

/** Page-number pager of the API and SMTP tables (total known). */
export function PagePager({
  search,
  setSearch,
  rows,
  total,
}: Readonly<{ search: LogsSearch; setSearch: SetLogsSearch; rows: number; total: number }>) {
  const labels = usePagerLabels()
  const page = search.page ?? 1
  const pageSize = search.pageSize ?? DEFAULT_PAGE_SIZE
  const toPage = (n: number) => setSearch({ page: n === 1 ? undefined : n, inspect: undefined })
  return (
    <DataTablePagination
      summary={rangeOf(page, pageSize, rows, total)}
      canPrevious={page > 1}
      canNext={page * pageSize < total}
      onPrevious={() => toPage(page - 1)}
      onNext={() => toPage(page + 1)}
      pageSize={pageSize}
      pageSizes={PAGE_SIZES}
      onPageSize={(size) => setSearch({ pageSize: size === DEFAULT_PAGE_SIZE ? undefined : size })}
      labels={labels}
    />
  )
}

/**
 * Keyset pager of the delivery log (no total): « Older » follows the cursor of the page,
 * « Newest » goes back to the first page (a keyset has no previous page).
 */
export function CursorPager({
  search,
  setSearch,
  rows,
  nextCursor,
}: Readonly<{
  search: LogsSearch
  setSearch: SetLogsSearch
  rows: number
  nextCursor: string | null
}>) {
  const { t } = useLingui()
  const labels = { ...usePagerLabels(), previous: t`Newest`, next: t`Older` }
  const pageSize = search.pageSize ?? DEFAULT_PAGE_SIZE
  return (
    <DataTablePagination
      summary={t`${rows} shown`}
      canPrevious={search.cursor !== undefined}
      canNext={nextCursor !== null}
      onPrevious={() => setSearch({ cursor: undefined, inspect: undefined })}
      onNext={() => nextCursor && setSearch({ cursor: nextCursor, inspect: undefined })}
      pageSize={pageSize}
      pageSizes={PAGE_SIZES}
      onPageSize={(size) => setSearch({ pageSize: size === DEFAULT_PAGE_SIZE ? undefined : size })}
      labels={labels}
    />
  )
}
