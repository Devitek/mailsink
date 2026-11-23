import { ConnectionsSearch } from '@mailsink/contracts'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { ConnectionsScreen } from '../features/connections/connections-screen'
import { connectionsQuery } from '../features/connections/queries'

// `/w/$workspaceSlug/connections` (#38): workspace settings and connections, rendered in the
// workspace layout (header, tabs, live stream). The layout already checks the session and
// answers « workspace not found ».
export const Route = createFileRoute('/w/$workspaceSlug/connections')({
  validateSearch: ConnectionsSearch,
  loader: async ({ context, params }) => {
    const page = await context.queryClient.ensureQueryData(connectionsQuery(params.workspaceSlug))
    if (!page) throw notFound()
  },
  component: ConnectionsRoute,
})

function ConnectionsRoute() {
  const { workspaceSlug } = Route.useParams()
  const { connection } = Route.useSearch()
  const { data: page } = useSuspenseQuery(connectionsQuery(workspaceSlug))
  return page ? <ConnectionsScreen page={page} selected={connection} /> : null
}
