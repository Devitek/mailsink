import { msg } from '@lingui/core/macro'
import { ConnectionsSearch } from '@mailsink/contracts'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { ConnectionsScreen } from '../features/connections/connections-screen'
import { connectionsQuery } from '../features/connections/queries'
import { endpointsQuery } from '../features/webhooks/queries'
import { pageTitle } from '../seo/page-title'

// `/w/$workspaceSlug/connections` (#38): workspace settings and connections, rendered in the
// workspace layout (header, tabs, live stream). The layout already checks the session and
// answers « workspace not found ».
export const Route = createFileRoute('/w/$workspaceSlug/connections')({
  validateSearch: ConnectionsSearch,
  loader: async ({ context, params }) => {
    const slug = params.workspaceSlug
    const [page] = await Promise.all([
      context.queryClient.ensureQueryData(connectionsQuery(slug)),
      // The « Active webhooks » list of the connection panel.
      context.queryClient.ensureQueryData(endpointsQuery(slug)).catch(() => undefined),
    ])
    if (!page) throw notFound()
  },
  head: ({ matches, params }) => {
    const slug = params.workspaceSlug
    return { meta: [pageTitle(matches, msg`Connections · ${slug}`)] }
  },
  component: ConnectionsRoute,
})

function ConnectionsRoute() {
  const { workspaceSlug } = Route.useParams()
  const { connection } = Route.useSearch()
  const { data: page } = useSuspenseQuery(connectionsQuery(workspaceSlug))
  return page ? <ConnectionsScreen page={page} selected={connection} /> : null
}
