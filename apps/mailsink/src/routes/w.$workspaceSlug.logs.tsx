import { msg } from '@lingui/core/macro'
import { LogsSearch } from '@mailsink/contracts'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { LogsPage } from '../features/logs/logs-page'
import type { SetLogsSearch } from '../features/logs/logs-pager'
import { prefetchLogs } from '../features/logs/prefetch'
import { changeSearch } from '../features/logs/search-query'
import { pageTitle } from '../seo/page-title'

// `/w/$workspaceSlug/logs` (#41): the logs explorer in the workspace layout (header, tabs,
// live stream). Tab, filters, sort, page and the inspected row are search params
// (LogsSearch); the loader prefetches the page of the tab, the facet sources and the
// inspected row during SSR and on entering the page, the stream keeps them fresh afterwards.
export const Route = createFileRoute('/w/$workspaceSlug/logs')({
  validateSearch: LogsSearch,
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ context: { queryClient }, params, deps: { search }, cause }) => {
    const prefetch = prefetchLogs(queryClient, params.workspaceSlug, search)
    // Within the page (filters, pager, inspector) the URL changes at once: the table keeps
    // its rows dimmed and the sheet shows « Loading… » until the data arrives.
    if (cause === 'stay') return void prefetch.catch(() => undefined)
    return prefetch
  },
  head: ({ matches }) => ({ meta: [pageTitle(matches, msg`Logs`)] }),
  component: LogsRoute,
})

function LogsRoute() {
  const { workspaceSlug } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const setSearch = useCallback<SetLogsSearch>(
    (change, options) =>
      void navigate({ search: (prev) => changeSearch(prev, change), replace: options?.replace }),
    [navigate],
  )
  return <LogsPage slug={workspaceSlug} search={search} setSearch={setSearch} />
}
