import { Trans } from '@lingui/react/macro'
import { cn } from '@mailsink/ui'
import type { LastDelivery as Delivery } from '../../server-fns/webhooks-types'
import { RelativeTime, useNow } from '../inbox/relative-time'

const TONE = {
  succeeded: 'text-ms-status-delivered',
  failed: 'text-ms-danger',
  pending: 'text-ms-text-muted',
  retrying: 'text-ms-status-deferred',
} as const

// « Dernière livraison » of the prototype: HTTP code (or the delivery status) and when.
export function LastDelivery({ delivery }: Readonly<{ delivery: Delivery | null }>) {
  const now = useNow()
  return (
    <span className="flex items-center gap-2">
      <Trans>Last delivery</Trans>
      {delivery ? (
        <span className={cn('font-mono', TONE[delivery.status])}>
          {delivery.statusCode ?? delivery.status} ·{' '}
          <RelativeTime iso={delivery.createdAt} now={now} />
        </span>
      ) : (
        <span className="font-mono text-ms-text-muted">
          <Trans>none yet</Trans>
        </span>
      )}
    </span>
  )
}
