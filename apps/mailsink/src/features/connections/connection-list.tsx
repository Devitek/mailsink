import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { buttonVariants, cn } from '@mailsink/ui'
import { Link } from '@tanstack/react-router'
import type { ConnectionRow } from '../../server-fns/connections-types'
import { rateLimitText } from '../workspaces/workspace-form'
import { KIND_LABELS, KindMark } from './kinds'

type ConnectionListProps = {
  slug: string
  connections: ConnectionRow[]
  /** Id of the connection open in the panel, or `new`. */
  selected: string | undefined
}

// Left column of the prototype connections screen: « + New connection », then one card per
// connection (kind initials, mono name, kind, rate limit override in amber). Selection
// lives in the URL (`?connection=`), so a connection can be linked to.
export function ConnectionList({ slug, connections, selected }: ConnectionListProps) {
  const { t } = useLingui()
  return (
    <div className="flex max-w-[360px] min-w-0 flex-[1_1_280px] flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">
          <Trans>Connections</Trans>
        </h2>
        <Link
          to="/w/$workspaceSlug/connections"
          params={{ workspaceSlug: slug }}
          search={{ connection: 'new' }}
          className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'h-7 px-3.5')}
        >
          <Trans>+ New connection</Trans>
        </Link>
      </div>
      <nav aria-label={t`Connections`} className="flex flex-col gap-2.5">
        {connections.map((c) => {
          const active = c.id === selected
          const rate = rateLimitText(c.rateLimit)
          return (
            <Link
              key={c.id}
              to="/w/$workspaceSlug/connections"
              params={{ workspaceSlug: slug }}
              search={{ connection: c.id }}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex items-center gap-[13px] rounded-md border px-4 py-[15px] text-left outline-none transition-colors duration-fast ease-ms hover:border-ms-border-strong focus-visible:focus-ring',
                active ? 'border-ms-accent bg-ms-panel' : 'border-ms-border',
                c.disabledAt && 'opacity-60',
              )}
            >
              <KindMark kind={c.kind} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-sm font-medium">{c.name}</div>
                <div className="text-[11.5px] text-ms-text-faint">
                  {KIND_LABELS[c.kind]}
                  {' · '}
                  <Plural value={c.messageCount} one="# message" other="# messages" />
                  {c.disabledAt && (
                    <>
                      {' · '}
                      <Trans>disabled</Trans>
                    </>
                  )}
                </div>
              </div>
              {rate && <span className="font-mono text-[10.5px] text-ms-override">{rate}/s</span>}
            </Link>
          )
        })}
        {connections.length === 0 && (
          <p className="rounded-md border border-dashed border-ms-border-strong p-4 text-sm text-ms-text-muted">
            <Trans>
              No connection yet: create one to receive mail from Resend, Brevo or SMTP clients.
            </Trans>
          </p>
        )}
      </nav>
    </div>
  )
}
