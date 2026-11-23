import { Trans, useLingui } from '@lingui/react/macro'
import { DeliveryStatus } from '@mailsink/contracts'
import { statusColorVar } from '@mailsink/ui'
import type { ViewerMessage } from '../../server-fns/messages-types'
import { formatReceived } from '../inbox/format-relative'
import { workspacePagePaths } from '../inbox/workspace-pages'
import { SectionTitle } from './links-tab'

type MessageEvent = ViewerMessage['events'][number]
type Delivery = NonNullable<ViewerMessage['webhookDeliveries']>[number]

const colorOf = (type: string) =>
  DeliveryStatus.safeParse(type).success
    ? statusColorVar(type as DeliveryStatus)
    : 'var(--ms-accent-text)'

function detailOf(event: MessageEvent): string {
  const { url, reason, smtpCode, userAgent } = event.data
  return [event.recipient, url, smtpCode, reason, userAgent].filter(Boolean).join(' · ')
}

const deliveryColor = (d: Delivery) =>
  d.status === 'succeeded'
    ? statusColorVar('delivered')
    : d.status === 'failed'
      ? statusColorVar('failed')
      : statusColorVar('deferred')

// Status timeline (every message event, oldest first) and the webhook deliveries of the
// message (newest first), with a way to the logs explorer.
export function HistoryTab({ slug, message }: Readonly<{ slug: string; message: ViewerMessage }>) {
  const { i18n } = useLingui()
  const time = (iso: string) => formatReceived(iso, i18n.locale)
  const events = [...message.events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  const deliveries = message.webhookDeliveries ?? []
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-[31px] px-[30px] py-6">
      <section>
        <SectionTitle>
          <Trans>Status timeline</Trans>
        </SectionTitle>
        <ol className="flex flex-col">
          {events.map((event) => (
            <li key={event.id} className="flex gap-4">
              <span aria-hidden className="flex w-2.5 shrink-0 flex-col items-center">
                <span
                  className="mt-1 size-[9px] shrink-0 rounded-full"
                  style={{ background: colorOf(event.type) }}
                />
                <span className="w-px flex-1 bg-ms-border-strong" />
              </span>
              <div className="min-w-0 pb-[22px]">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className="font-mono text-xs font-medium"
                    style={{ color: colorOf(event.type) }}
                  >
                    {event.type}
                  </span>
                  <time
                    dateTime={event.occurredAt}
                    className="font-mono text-label text-ms-text-faint"
                    suppressHydrationWarning
                  >
                    {time(event.occurredAt)}
                  </time>
                  <span className="inline-flex h-[17px] items-center rounded-xs border border-ms-border-strong px-[5px] text-badge text-ms-text-muted">
                    {event.origin}
                  </span>
                </div>
                <div className="mt-0.5 text-sm break-all text-ms-text-muted">{detailOf(event)}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <SectionTitle>
          <Trans>Webhook deliveries · {deliveries.length}</Trans>
        </SectionTitle>
        {deliveries.length === 0 ? (
          <p className="rounded-md border border-dashed border-ms-border-strong p-[19px] text-sm text-ms-text-faint">
            <Trans>No webhook delivery for this message.</Trans>
          </p>
        ) : (
          <ul className="overflow-hidden rounded-md border border-ms-border bg-ms-panel">
            {deliveries.map((d) => (
              <li
                key={d.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-[13px] border-b border-ms-border px-4 py-[11px] font-mono text-[11.5px] last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="truncate">{d.dialectEvent}</div>
                  <div
                    className="truncate text-badge text-ms-text-faint"
                    title={d.endpointUrl ?? d.endpointId}
                  >
                    {d.payloadFormat} · {d.endpointUrl ?? d.endpointId} · {time(d.createdAt)}
                  </div>
                </div>
                <span className="text-right">
                  <span className="font-semibold" style={{ color: deliveryColor(d) }}>
                    {d.lastStatusCode ?? d.status}
                  </span>
                  {d.durationMs !== null && (
                    <span className="block text-badge text-ms-text-faint">
                      <Trans>{d.durationMs} ms</Trans>
                    </span>
                  )}
                </span>
                <span className="text-right text-ms-text-muted">
                  <Trans>{d.attemptCount} att.</Trans>
                </span>
              </li>
            ))}
          </ul>
        )}
        <a
          href={workspacePagePaths.webhookLogs(slug)}
          className="mt-[13px] inline-block text-sm text-ms-accent-text underline-offset-4 hover:underline"
        >
          <Trans>See in the logs explorer →</Trans>
        </a>
      </section>
    </div>
  )
}
