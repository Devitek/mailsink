import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { cn, Switch } from '@mailsink/ui'
import { Link } from '@tanstack/react-router'
import { useId } from 'react'
import type { WorkspaceList, WorkspaceSummary } from '../../server-fns/workspace-types'
import { EphemeralBadge } from './ephemeral-badge'

type SectionsProps = {
  list: WorkspaceList
  /** Slug of the open workspace: checked in the list. */
  current?: string
  showEphemeral: boolean
  onShowEphemeralChange: (show: boolean) => void
  onPick?: () => void
}

function Row({
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
      {workspace.ephemeral && <EphemeralBadge expiresAt={workspace.expiresAt} />}
    </Link>
  )
}

// Content of the workspace picker (prototype header popover, and the `/` page): persistent
// workspaces, then the switch revealing the ephemeral ones, hidden by default.
export function WorkspaceSections({
  list,
  current,
  showEphemeral,
  onShowEphemeralChange,
  onPick,
}: SectionsProps) {
  const { t } = useLingui()
  const labelId = useId()
  const count = list.ephemeralCount
  return (
    <div className="flex flex-col">
      <h2 className="px-4 pt-3.5 pb-2 text-label font-medium tracking-[0.06em] text-ms-text-faint uppercase">
        <Trans>Persistent workspaces</Trans>
      </h2>
      <nav aria-label={t`Persistent workspaces`} className="flex flex-col gap-px px-2 pb-2">
        {list.persistent.map((w) => (
          <Row key={w.id} workspace={w} current={current} onPick={onPick} />
        ))}
        {list.persistent.length === 0 && (
          <p className="px-2.5 py-2 text-body text-ms-text-muted">
            <Trans>No persistent workspace yet.</Trans>
          </p>
        )}
      </nav>
      <div className="flex items-center gap-3 border-t border-ms-border px-4 py-3.5">
        <Switch
          checked={showEphemeral}
          onCheckedChange={onShowEphemeralChange}
          aria-labelledby={labelId}
        />
        <div className="min-w-0 flex-1">
          <div id={labelId} className="text-sm">
            <Trans>Show ephemeral workspaces</Trans>
          </div>
          <div className="text-xs text-ms-text-faint">
            <Plural
              value={count}
              one="# created through the Admin API (CI / E2E)"
              other="# created through the Admin API (CI / E2E)"
            />
          </div>
        </div>
      </div>
      {showEphemeral && list.ephemeral.length > 0 && (
        <nav aria-label={t`Ephemeral workspaces`} className="flex flex-col gap-px px-2 pb-2">
          {list.ephemeral.map((w) => (
            <Row key={w.id} workspace={w} current={current} onPick={onPick} />
          ))}
        </nav>
      )}
    </div>
  )
}
