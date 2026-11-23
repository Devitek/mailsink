import { InboxSearch } from '@mailsink/contracts'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import type { SetSearch } from '../features/inbox/filter-bar'
import { InboxPage } from '../features/inbox/inbox-page'
import { facetsQuery, inboxListQuery, messageQuery } from '../features/inbox/queries'
import { inboxFilters } from '../features/inbox/search-query'

// The inbox of a workspace (#39) with its message viewer (#40). Filters, the open message
// and its tab are search params (InboxSearch); the loader prefetches the first page, the
// counts and the open message during SSR, the stream keeps them fresh afterwards.
export const Route = createFileRoute('/w/$workspaceSlug/')({
  validateSearch: InboxSearch,
  loaderDeps: ({ search }) => ({ filters: inboxFilters(search), m: search.m }),
  loader: async ({ context: { queryClient }, params, deps }) => {
    const slug = params.workspaceSlug
    const [list] = await Promise.all([
      queryClient.ensureInfiniteQueryData(inboxListQuery(slug, deps.filters)),
      queryClient.ensureQueryData(facetsQuery(slug)),
    ])
    const open = deps.m ?? list.pages[0]?.data[0]?.id
    // A message purged meanwhile is not an error of the page: the viewer says so.
    if (open) await queryClient.ensureQueryData(messageQuery(slug, open)).catch(() => undefined)
  },
  component: InboxRoute,
})

function InboxRoute() {
  const { workspaceSlug } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const setSearch = useCallback<SetSearch>(
    (change, options) =>
      void navigate({ search: (prev) => ({ ...prev, ...change }), replace: options?.replace }),
    [navigate],
  )
  return <InboxPage slug={workspaceSlug} search={search} setSearch={setSearch} />
}
