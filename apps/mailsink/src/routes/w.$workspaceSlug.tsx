import { Trans } from '@lingui/react/macro'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { ensureSignedIn } from '../auth/guard'
import { AppHeader } from '../features/shell/app-header'
import { EphemeralBadge } from '../features/workspaces/ephemeral-badge'
import { workspaceQuery } from '../features/workspaces/queries'

export const Route = createFileRoute('/w/$workspaceSlug')({
  beforeLoad: ({ location }) => ensureSignedIn(location),
  loader: async ({ context, params }) => {
    const workspace = await context.queryClient.ensureQueryData(
      workspaceQuery(params.workspaceSlug),
    )
    if (!workspace) throw notFound()
  },
  component: WorkspacePage,
  notFoundComponent: WorkspaceNotFound,
})

// Direct access to a workspace (`/w/$workspaceSlug`). Opening it touches its activity and
// makes it the default page after the next sign-in. The inbox replaces the placeholder
// body in #39.
function WorkspacePage() {
  const { workspaceSlug } = Route.useParams()
  const { data: workspace } = useSuspenseQuery(workspaceQuery(workspaceSlug))
  if (!workspace) return null
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader workspace={workspace} />
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <h1 className="text-title font-semibold tracking-[-0.02em]">{workspace.name}</h1>
        <p className="flex items-center gap-2 font-mono text-sm text-ms-text-muted">
          {workspace.slug}
          {workspace.ephemeral && <EphemeralBadge expiresAt={workspace.expiresAt} withLabel />}
        </p>
        <p className="max-w-[420px] text-body text-ms-text-muted">
          <Trans>The message list of this workspace is not available yet.</Trans>
        </p>
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
