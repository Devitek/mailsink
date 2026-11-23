import { Trans, useLingui } from '@lingui/react/macro'
import type { InboxConnectionFacet } from '@mailsink/core'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useMemo, useRef } from 'react'
import { connectionOf } from './connection-label'
import { MessageRow, ROW_HEIGHT } from './message-row'
import { inboxListQuery } from './queries'
import { useNow } from './relative-time'
import type { InboxFilters } from './search-query'

/** Rows left below the viewport when the next page is requested. */
const PREFETCH_ROWS = 30

// Virtual list of the inbox (TanStack Virtual): only the visible rows are in the DOM, pages
// of the Capture list are fetched as the scroll nears the end. New messages pushed by the
// stream are prepended to the cached first page.
export function MessageList({
  slug,
  filters,
  selectedId,
  connections,
}: Readonly<{
  slug: string
  filters: InboxFilters
  selectedId: string | undefined
  connections: readonly InboxConnectionFacet[] | undefined
}>) {
  const { t } = useLingui()
  const now = useNow()
  const scrollRef = useRef<HTMLDivElement>(null)
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage, isPending } = useInfiniteQuery(
    inboxListQuery(slug, filters),
  )
  const rows = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data])
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (index) => rows[index]?.id ?? index,
    overscan: 8,
    // The server renders the first screen of rows too.
    initialRect: { width: 400, height: 900 },
  })
  const items = virtualizer.getVirtualItems()
  const lastIndex = items.at(-1)?.index ?? 0

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && lastIndex >= rows.length - PREFETCH_ROWS) {
      void fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, lastIndex, rows.length, fetchNextPage])

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
      {rows.length === 0 && !isPending && (
        <p className="px-[22px] py-[38px] text-center text-sm text-ms-text-faint">
          <Trans>No message matches.</Trans>
        </p>
      )}
      <ul
        aria-label={t`Messages`}
        aria-busy={isPending || isFetchingNextPage}
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {items.map((item) => {
          const row = rows[item.index]
          if (!row) return null
          return (
            <li
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <MessageRow
                slug={slug}
                row={row}
                selected={row.id === selectedId}
                connection={connectionOf(row, connections)}
                now={now}
              />
            </li>
          )
        })}
      </ul>
      {isFetchingNextPage && (
        <p className="py-3 text-center text-xs text-ms-text-faint">
          <Trans>Loading older messages…</Trans>
        </p>
      )}
    </div>
  )
}
