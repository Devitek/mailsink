import { Trans } from '@lingui/react/macro'
import { buttonVariants, cn } from '@mailsink/ui'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { LastDelivery } from '../webhooks/last-delivery'
import { endpointsQuery } from '../webhooks/queries'

// « Webhooks actifs » of the prototype connection panel: the endpoints scoped to this
// connection (enabled first, a dot for their state), their last delivery, and the way to
// the webhooks section of the settings to manage them or add one.
export function ConnectionWebhooks({
  slug,
  connectionId,
}: Readonly<{ slug: string; connectionId: string }>) {
  const { data } = useQuery(endpointsQuery(slug))
  const endpoints = (data ?? [])
    .filter((e) => e.connectionId === connectionId)
    .sort((a, b) => Number(b.enabled) - Number(a.enabled))
  const active = endpoints.filter((e) => e.enabled).length
  return (
    <section aria-labelledby={`hooks-${connectionId}`}>
      <div className="mb-2 flex items-center gap-2.5">
        <h3 id={`hooks-${connectionId}`} className="flex-1 text-xs font-medium text-ms-text-muted">
          <Trans>Active webhooks ({active})</Trans>
        </h3>
        <Link
          to="/w/$workspaceSlug/settings"
          params={{ workspaceSlug: slug }}
          search={{ section: 'webhooks' }}
          className={buttonVariants({ size: 'sm' })}
        >
          <Trans>Manage / Add a webhook →</Trans>
        </Link>
      </div>
      {data && endpoints.length === 0 ? (
        <p className="rounded-md border border-dashed border-ms-border-strong px-3.5 py-3 text-xs text-ms-text-faint">
          <Trans>No webhook is scoped to this connection (workspace-wide ones also apply).</Trans>
        </p>
      ) : (
        <ul className="overflow-hidden rounded-md border border-ms-border">
          {endpoints.map((e) => (
            <li
              key={e.id}
              className={cn(
                'flex items-center gap-2.5 border-b border-ms-border bg-ms-bg px-3.5 py-[9px] text-xs last:border-b-0',
                !e.enabled && 'opacity-55',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  e.enabled ? 'bg-ms-status-delivered' : 'bg-ms-text-faint',
                )}
              />
              <span className="min-w-0 flex-1 truncate font-mono" title={e.url}>
                {e.url}
              </span>
              <span className="shrink-0 font-mono text-ms-text-faint">{e.payloadFormat}</span>
              <span className="shrink-0 text-ms-text-faint">
                <LastDelivery delivery={e.lastDelivery} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
