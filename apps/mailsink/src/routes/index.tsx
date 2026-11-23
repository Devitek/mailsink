import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { PickerSearch } from '@mailsink/contracts'
import { Card } from '@mailsink/ui'
import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { ensureSignedIn } from '../auth/guard'
import { AppHeader } from '../features/shell/app-header'
import { workspacesQuery } from '../features/workspaces/queries'
import { WorkspaceSections } from '../features/workspaces/workspace-sections'
import { pageTitle } from '../seo/page-title'

export const Route = createFileRoute('/')({
  validateSearch: PickerSearch,
  // `/` stays `/` while the switch is off (its default).
  search: { middlewares: [stripSearchParams({ ephemeral: false })] },
  beforeLoad: ({ location }) => ensureSignedIn(location),
  loaderDeps: ({ search }) => ({ ephemeral: search.ephemeral }),
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureInfiniteQueryData(workspacesQuery(false)),
      deps.ephemeral && context.queryClient.ensureInfiniteQueryData(workspacesQuery(true)),
    ])
  },
  head: ({ matches }) => ({ meta: [pageTitle(matches, msg`Choose a workspace`)] }),
  component: WorkspacePickerPage,
})

// `/`: the workspace picker as a page, for a visitor with no workspace open yet. The
// switch state lives in the URL (`?ephemeral=true`), so the view can be shared.
function WorkspacePickerPage() {
  const { ephemeral } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="flex flex-1 justify-center px-5 py-12 max-sm:px-0 max-sm:py-6">
        <div className="flex w-full max-w-[480px] flex-col gap-4">
          <div className="px-1 max-sm:px-5">
            <h1 className="text-title font-semibold tracking-[-0.02em]">
              <Trans>Choose a workspace</Trans>
            </h1>
            <p className="mt-1.5 text-body text-ms-text-muted">
              <Trans>Each workspace keeps its own messages, connections and webhooks.</Trans>
            </p>
          </div>
          <Card className="overflow-hidden max-sm:rounded-none max-sm:border-x-0">
            <WorkspaceSections
              showEphemeral={ephemeral}
              onShowEphemeralChange={(show) =>
                navigate({ search: { ephemeral: show }, replace: true })
              }
            />
          </Card>
        </div>
      </main>
    </div>
  )
}
