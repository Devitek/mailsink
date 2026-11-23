import { Trans, useLingui } from '@lingui/react/macro'
import type { InboxSearch } from '@mailsink/contracts'
import { cn } from '@mailsink/ui'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { MessageViewer } from '../message-viewer/message-viewer'
import { PurgeButton } from '../message-viewer/purge-button'
import { EmptyInbox } from './empty-inbox'
import { FilterBar, type SetSearch } from './filter-bar'
import { MessageList } from './message-list'
import { facetsQuery, inboxListQuery } from './queries'
import { hasFilters, inboxFilters } from './search-query'

// Inbox of the prototype (#39, #40): the 400 px list with its filters on the left, the
// viewer of the open message (or of the newest one) on the right. Below 768 px one pane
// shows at a time: the list, or the viewer opened by `?m=`.
export function InboxPage({
  slug,
  search,
  setSearch,
}: Readonly<{ slug: string; search: InboxSearch; setSearch: SetSearch }>) {
  const { t } = useLingui()
  const filters = inboxFilters(search)
  const { data: facets } = useQuery(facetsQuery(slug))
  const { data: list } = useInfiniteQuery(inboxListQuery(slug, filters))
  const openId = search.m ?? list?.pages[0]?.data[0]?.id
  const empty = facets?.total === 0 && !hasFilters(filters)

  const back = (
    <Link
      to="/w/$workspaceSlug"
      params={{ workspaceSlug: slug }}
      search={(prev) => ({ ...prev, m: undefined, tab: undefined })}
      className="mb-3.5 inline-block text-sm text-ms-text-muted hover:text-ms-text md:hidden"
    >
      <Trans>← Inbox</Trans>
    </Link>
  )

  return (
    <div className="flex min-h-0 flex-1">
      <section
        aria-label={t`Inbox`}
        className={cn(
          'flex min-h-0 w-(--ms-list-w) shrink-0 flex-col border-r border-ms-border bg-ms-panel max-md:w-full',
          search.m && 'max-md:hidden',
        )}
      >
        <FilterBar search={search} facets={facets} setSearch={setSearch} />
        <MessageList
          slug={slug}
          filters={filters}
          selectedId={openId}
          connections={facets?.connections}
        />
      </section>
      <section
        aria-label={t`Message`}
        className={cn('flex min-h-0 min-w-0 flex-1 flex-col', !search.m && 'max-md:hidden')}
      >
        {empty ? (
          <EmptyInbox slug={slug} />
        ) : openId ? (
          <MessageViewer
            key={openId}
            slug={slug}
            messageId={openId}
            tab={search.tab ?? 'preview'}
            onTabChange={(tab) =>
              setSearch({ m: openId, tab: tab === 'preview' ? undefined : tab }, { replace: true })
            }
            connections={facets?.connections}
            purge={
              <PurgeButton
                slug={slug}
                count={facets?.total ?? 0}
                onPurged={() => setSearch({ m: undefined, tab: undefined })}
              />
            }
            back={back}
          />
        ) : (
          <p className="grid flex-1 place-items-center p-8 text-body text-ms-text-faint">
            <Trans>No message to show with these filters.</Trans>
          </p>
        )}
      </section>
    </div>
  )
}
