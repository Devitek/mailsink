import { Trans, useLingui } from '@lingui/react/macro'
import type { WebhookDeliveryView } from '@mailsink/contracts'
import { type DataTableColumn, dataTableColumns } from '@mailsink/ui'
import { useMemo } from 'react'
import type { LogSources } from '../../server-fns/logs-types'
import { ConnectionCell, LogTime } from './cells'
import { DELIVERY_TONE } from './format'
import { CodeBadge, TypeBadge } from './log-badges'

const col = dataTableColumns<WebhookDeliveryView>()

/** `200`, or the delivery status while no attempt answered. */
export const deliveryCode = (d: WebhookDeliveryView): string =>
  d.lastStatusCode !== null ? `${d.lastStatusCode} ${d.status}` : d.status

// Columns of the webhook deliveries table: the payload format, the endpoint scope, the
// dialect event (and recipient), the delivery status with the last HTTP code, the attempts.
export function useWebhookColumns(
  sources: LogSources | undefined,
  now: number,
): DataTableColumn<WebhookDeliveryView>[] {
  const { t } = useLingui()
  return useMemo(
    () => [
      col.accessor('createdAt', {
        header: t`Timestamp`,
        cell: (c) => <LogTime iso={c.getValue()} now={now} />,
      }),
      col.accessor('payloadFormat', {
        id: 'type',
        header: t`Format`,
        cell: (c) => <TypeBadge kind="webhook">{c.getValue()}</TypeBadge>,
      }),
      col.accessor('endpointId', {
        id: 'connection',
        header: t`Connection`,
        cell: (c) => {
          const endpoint = sources?.endpoints.find((e) => e.id === c.getValue())
          return (
            <ConnectionCell
              id={endpoint?.connectionId ?? null}
              connections={sources?.connections}
            />
          )
        },
      }),
      col.accessor('dialectEvent', {
        id: 'action',
        header: t`Event`,
        cell: ({ row }) => {
          const d = row.original
          return (
            <span title={d.canonicalEvent}>
              {d.dialectEvent}
              {d.recipient && <span className="text-ms-text-muted"> · {d.recipient}</span>}
              {d.replayMode && (
                <span className="text-ms-text-faint">
                  {' '}
                  · <Trans>replay {d.replayMode}</Trans>
                </span>
              )}
            </span>
          )
        },
      }),
      col.accessor('status', {
        header: t`Status`,
        cell: ({ row }) => (
          <CodeBadge tone={DELIVERY_TONE[row.original.status]}>
            {deliveryCode(row.original)}
          </CodeBadge>
        ),
      }),
      col.accessor('attemptCount', {
        id: 'durationMs',
        header: t`Attempts`,
        cell: (c) => <span className="text-ms-text-muted">{c.getValue()}</span>,
      }),
    ],
    [t, sources, now],
  )
}
