import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '@mailsink/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { WorkspaceSettings } from '../../server-fns/connections-types'
import { deleteWorkspaceFn } from '../../server-fns/workspaces-manage-fns'
import { ConfirmDialog } from './confirm-dialog'
import { EditWorkspaceDialog } from './edit-workspace-dialog'
import { EphemeralBadge } from './ephemeral-badge'
import { rateLimitText, retentionChoice } from './workspace-form'

// Workspace card of the management screen (#38): name, slug, defaults, then « Edit » and
// « Delete » (confirmed by typing the slug; ephemeral workspaces too).
export function WorkspaceSummary({ workspace }: Readonly<{ workspace: WorkspaceSettings }>) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const slug = workspace.slug
  const retention = retentionChoice(workspace.retentionSeconds)
  const rate = rateLimitText(workspace.rateLimit)

  async function remove() {
    await deleteWorkspaceFn({ data: { slug } })
    await queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    await navigate({ to: '/', replace: true })
    queryClient.removeQueries({ queryKey: ['connections', slug] })
    queryClient.removeQueries({ queryKey: ['workspace', slug] })
  }

  return (
    <section
      aria-label={t`Workspace`}
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-ms-border bg-ms-panel px-[22px] py-[19px]"
    >
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2.5 text-heading font-semibold">
          <span className="truncate">{workspace.name}</span>
          {workspace.ephemeral && <EphemeralBadge expiresAt={workspace.expiresAt} withLabel />}
        </h2>
        <p className="font-mono text-xs text-ms-text-faint">/w/{slug}</p>
        {workspace.description && (
          <p className="mt-1 text-sm text-ms-text-muted">{workspace.description}</p>
        )}
      </div>
      <dl className="flex gap-6 text-xs">
        <div>
          <dt className="text-ms-text-faint">
            <Trans>Retention</Trans>
          </dt>
          <dd className="font-mono text-ms-text" data-testid="workspace-retention">
            {/^\d+$/.test(retention) ? `${retention}s` : retention}
          </dd>
        </div>
        <div>
          <dt className="text-ms-text-faint">
            <Trans>Rate limit</Trans>
          </dt>
          <dd className="font-mono text-ms-text" data-testid="workspace-rate-limit">
            {rate ? `${rate} req/s` : <Trans>unlimited</Trans>}
          </dd>
        </div>
      </dl>
      <div className="flex gap-2">
        <EditWorkspaceDialog workspace={workspace} />
        <ConfirmDialog
          danger
          trigger={<Button variant="danger" />}
          triggerLabel={<Trans>Delete</Trans>}
          title={<Trans>Delete the workspace {slug}?</Trans>}
          description={
            <Trans>
              Its connections, keys, messages, logs and webhooks are deleted at once. This cannot be
              undone.
            </Trans>
          }
          requireText={slug}
          requireLabel={<Trans>Type the slug to confirm</Trans>}
          confirmLabel={<Trans>Delete the workspace</Trans>}
          onConfirm={remove}
        />
      </div>
    </section>
  )
}
