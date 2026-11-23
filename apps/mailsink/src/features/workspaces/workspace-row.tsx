import { Trans } from '@lingui/react/macro'
import { cn } from '@mailsink/ui'
import { Link } from '@tanstack/react-router'
import type { WorkspaceSummary } from '../../server-fns/workspace-types'
import { EphemeralBadge } from './ephemeral-badge'

// One workspace of the picker: check mark on the open one, slug, message count (persistent)
// or TTL pill (ephemeral).
export function WorkspaceRow({
  workspace,
  current,
  onPick,
}: Readonly<{ workspace: WorkspaceSummary; current?: string; onPick?: () => void }>) {
  const active = workspace.slug === current
  return (
    <Link
      to="/w/$workspaceSlug"
      params={{ workspaceSlug: workspace.slug }}
      onClick={onPick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-sm px-2.5 py-2 text-ms-text outline-none hover:bg-ms-hover focus-visible:bg-ms-hover focus-visible:focus-ring',
        active && 'bg-ms-hover',
      )}
    >
      <span aria-hidden className="w-3.5 text-center text-xs text-ms-accent-text">
        {active ? '✓' : ''}
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate font-mono text-sm',
          workspace.ephemeral && 'text-ms-text-muted',
        )}
      >
        {workspace.slug}
      </span>
      {workspace.messageCount !== undefined && (
        <span className="shrink-0 text-xs text-ms-text-faint">
          <Trans>{workspace.messageCount} msg</Trans>
        </span>
      )}
      {workspace.ephemeral && <EphemeralBadge expiresAt={workspace.expiresAt} />}
    </Link>
  )
}
