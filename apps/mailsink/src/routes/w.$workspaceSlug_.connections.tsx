import { Trans } from '@lingui/react/macro'
import { ConnectionsSearch } from '@mailsink/contracts'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { ensureSignedIn } from '../auth/guard'
import { ConnectionsScreen } from '../features/connections/connections-screen'
import { connectionsQuery } from '../features/connections/queries'
import { AppHeader } from '../features/shell/app-header'
import { workspaceQuery } from '../features/workspaces/queries'

// `/w/$workspaceSlug/connections` (#38): workspace settings and connections. Not nested in
// the workspace layout yet (trailing `_`): it renders its own header until that layout
// renders an <Outlet />.
export const Route = createFileRoute('/w/$workspaceSlug_/connections')({
  validateSearch: ConnectionsSearch,
  beforeLoad: ({ location }) => ensureSignedIn(location),
  loader: async ({ context, params }) => {
    const slug = params.workspaceSlug
    const [workspace, page] = await Promise.all([
      context.queryClient.ensureQueryData(workspaceQuery(slug)),
      context.queryClient.ensureQueryData(connectionsQuery(slug)),
    ])
    if (!workspace || !page) throw notFound()
  },
  component: ConnectionsRoute,
  notFoundComponent: NotFound,
})

function ConnectionsRoute() {
  const { workspaceSlug } = Route.useParams()
  const { connection } = Route.useSearch()
  const { data: workspace } = useSuspenseQuery(workspaceQuery(workspaceSlug))
  const { data: page } = useSuspenseQuery(connectionsQuery(workspaceSlug))
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader workspace={workspace ?? undefined} />
      {page && <ConnectionsScreen page={page} selected={connection} />}
    </div>
  )
}

function NotFound() {
  const { workspaceSlug } = Route.useParams()
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <h1 className="text-title font-semibold tracking-[-0.02em]">
          <Trans>Workspace not found</Trans>
        </h1>
        <p className="text-body text-ms-text-muted">
          <Trans>
            No workspace is named <code className="font-mono text-ms-text">{workspaceSlug}</code>.
            It may have expired.
          </Trans>
        </p>
        <Link to="/" className="text-sm text-ms-accent-text underline-offset-4 hover:underline">
          <Trans>Choose a workspace</Trans>
        </Link>
      </main>
    </div>
  )
}
