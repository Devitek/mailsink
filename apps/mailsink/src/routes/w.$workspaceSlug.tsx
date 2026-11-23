import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound, Outlet } from '@tanstack/react-router'
import { ensureSignedIn } from '../auth/guard'
import { facetsQuery } from '../features/inbox/queries'
import { overrideQuery } from '../features/override/queries'
import { LiveIndicator } from '../features/realtime/live-indicator'
import { useWorkspaceStream } from '../features/realtime/use-workspace-stream'
import { AppHeader } from '../features/shell/app-header'
import { NavTabs } from '../features/shell/nav-tabs'
import { EphemeralBanner } from '../features/workspaces/ephemeral-banner'
import { workspaceQuery } from '../features/workspaces/queries'
import { documentTitle, pageTitle } from '../seo/page-title'

export const Route = createFileRoute('/w/$workspaceSlug')({
  beforeLoad: ({ location }) => ensureSignedIn(location),
  loader: async ({ context, params }) => {
    const workspace = await context.queryClient.ensureQueryData(
      workspaceQuery(params.workspaceSlug),
    )
    if (!workspace) throw notFound()
    // The header counts and the override pill render with the page (no pop-in).
    await Promise.all([
      context.queryClient.ensureQueryData(facetsQuery(params.workspaceSlug)),
      context.queryClient.ensureQueryData(overrideQuery(params.workspaceSlug)),
    ])
  },
  // Children set their own page title; the layout names the workspace, or says it is gone.
  head: ({ matches, params }) => {
    const found = matches.find((m) => m.routeId === '/w/$workspaceSlug')?.status !== 'notFound'
    return {
      meta: [
        found
          ? { title: documentTitle(params.workspaceSlug) }
          : pageTitle(matches, msg`Workspace not found`),
      ],
    }
  },
  component: WorkspaceLayout,
  notFoundComponent: WorkspaceNotFound,
})

// Layout of a workspace (`/w/$workspaceSlug/…`): header with the Messages / Logs / Settings
// / Connections tabs and their counts (a row of their own under the header below 768 px),
// the live stream indicator, the TTL banner of an ephemeral workspace, then the page (the
// inbox, or the pages of the other Phase 4 lots). Opening it touches the workspace's
// activity and makes it the default page after the next sign-in. One stream per open
// workspace feeds every page; its frames keep the override pill, the counts and the TTL
// banner live.
function WorkspaceLayout() {
  const { workspaceSlug } = Route.useParams()
  const { data: workspace } = useSuspenseQuery(workspaceQuery(workspaceSlug))
  const { data: facets } = useQuery(facetsQuery(workspaceSlug))
  const { state, deleted } = useWorkspaceStream(workspaceSlug)
  if (!workspace) return null
  const counts = { messages: facets?.total, logs: facets?.logs }
  return (
    <div className="flex h-dvh flex-col">
      <AppHeader workspace={workspace} counts={counts} status={<LiveIndicator state={state} />} />
      <NavTabs workspaceSlug={workspace.slug} counts={counts} variant="bar" />
      <EphemeralBanner workspace={workspace} />
      <h1 className="sr-only">{workspace.name}</h1>
      {deleted && (
        <p
          role="alert"
          className="flex flex-wrap items-center gap-3 border-b border-ms-border bg-[color-mix(in_oklch,var(--ms-danger)_8%,var(--ms-panel))] px-[19px] py-3 text-sm"
        >
          <Trans>This workspace was deleted (expired or removed through the Admin API).</Trans>
          <Link to="/" className="text-ms-accent-text underline-offset-4 hover:underline">
            <Trans>Choose a workspace</Trans>
          </Link>
        </p>
      )}
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}

function WorkspaceNotFound() {
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
