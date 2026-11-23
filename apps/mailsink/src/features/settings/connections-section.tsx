import { Trans } from '@lingui/react/macro'
import { buttonVariants } from '@mailsink/ui'
import { Link } from '@tanstack/react-router'
import type { SettingsPage } from '../../server-fns/settings-types'
import { KIND_LABELS, KindMark } from '../connections/kinds'
import { SectionHeader } from './section-header'

// « Connexions » section (#43): the connections are managed on their own page (#38); this
// section lists them and links there, one connection or the creation form.
export function ConnectionsSection({ page }: Readonly<{ page: SettingsPage }>) {
  const slug = page.workspace.slug
  const { connections } = page
  return (
    <div>
      <SectionHeader
        title={<Trans>Connections</Trans>}
        description={
          <Trans>Credentials, .env snippets, rotation and per-connection rate limits.</Trans>
        }
      >
        <Link
          to="/w/$workspaceSlug/connections"
          params={{ workspaceSlug: slug }}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          <Trans>Manage the connections →</Trans>
        </Link>
      </SectionHeader>
      <ul className="overflow-hidden rounded-lg border border-ms-border bg-ms-panel">
        {connections.map((connection) => (
          <li key={connection.id} className="border-b border-ms-border last:border-b-0">
            <Link
              to="/w/$workspaceSlug/connections"
              params={{ workspaceSlug: slug }}
              search={{ connection: connection.id }}
              className="flex items-center gap-[13px] px-4 py-3 outline-none hover:bg-ms-hover focus-visible:focus-ring"
            >
              <KindMark kind={connection.kind} />
              <span className="flex-1 truncate font-mono text-sm">{connection.name}</span>
              <span className="text-xs text-ms-text-faint">{KIND_LABELS[connection.kind]}</span>
              {connection.disabled && (
                <span className="text-xs text-ms-text-muted">
                  <Trans>Disabled</Trans>
                </span>
              )}
            </Link>
          </li>
        ))}
        {connections.length === 0 && (
          <li className="px-4 py-[14px] text-sm text-ms-text-faint">
            <Trans>No connection yet.</Trans>{' '}
            <Link
              to="/w/$workspaceSlug/connections"
              params={{ workspaceSlug: slug }}
              search={{ connection: 'new' }}
              className="text-ms-accent-text underline-offset-4 hover:underline"
            >
              <Trans>Create one</Trans>
            </Link>
          </li>
        )}
      </ul>
    </div>
  )
}
