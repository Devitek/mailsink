import { Trans, useLingui } from '@lingui/react/macro'
import type { ReplayMode, WebhookDeliveryView } from '@mailsink/contracts'
import { Button, SegmentedControl } from '@mailsink/ui'
import { useState } from 'react'
import type { InspectedDelivery } from '../../server-fns/logs-types'
import { staleSignatureMinutes } from './replay-warning'
import { useReplay } from './use-replay'

// « Replay the webhook » box of the prototype (#41, D139): target endpoint, the choice
// between `exact` (the last attempt's headers byte for byte, signature included) and
// `resign` (fresh timestamp and signature), the Svix timestamp tolerance warning, and the
// optimistic replay. A delivery without attempts can only be re-signed (409 otherwise).
/** The list row of a delivery (the detail adds its body, attempts and endpoint). */
function viewOf(delivery: InspectedDelivery): WebhookDeliveryView {
  const { body: _b, contentType: _c, attempts: _a, endpoint: _e, ...view } = delivery
  return view
}

export function ReplayPanel({
  slug,
  delivery,
  onOpen,
}: Readonly<{ slug: string; delivery: InspectedDelivery; onOpen: (id: string) => void }>) {
  const { t } = useLingui()
  const last = delivery.attempts.at(-1)
  const [mode, setMode] = useState<ReplayMode>(last ? 'exact' : 'resign')
  const replay = useReplay(slug)
  const stale =
    mode === 'exact' ? staleSignatureMinutes(delivery.payloadFormat, last?.signedAt ?? null) : null
  const sent = replay.data

  return (
    <div className="flex flex-col gap-3 rounded-md border border-ms-border bg-ms-bg p-4">
      <div className="flex flex-wrap items-center gap-[13px]">
        <div className="min-w-[200px] flex-1">
          <div className="text-label font-medium tracking-[0.06em] text-ms-text-faint uppercase">
            <Trans>Target endpoint</Trans>
          </div>
          <div className="mt-0.5 font-mono text-xs break-all">
            {delivery.endpoint?.url ?? delivery.endpointId}
          </div>
        </div>
        <SegmentedControl
          aria-label={t`Replay mode`}
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'exact', label: 'exact' },
            { value: 'resign', label: 'resign' },
          ]}
          className="w-[160px]"
          fill
        />
        <Button
          variant="primary"
          disabled={replay.isPending || (mode === 'exact' && !last)}
          onClick={() => replay.mutate({ source: viewOf(delivery), mode })}
        >
          <span aria-hidden>↻</span>
          <Trans>Replay the webhook</Trans>
        </Button>
      </div>
      <p className="m-0 text-xs text-ms-text-muted">
        {mode === 'exact' ? (
          <Trans>
            Sends the body and the headers of the last attempt byte for byte, signature included:
            tests replay protection.
          </Trans>
        ) : (
          <Trans>
            Same body and delivery id, fresh timestamp and signature: the receiver accepts it.
          </Trans>
        )}
      </p>
      {stale !== null && (
        <p role="note" className="m-0 text-xs text-ms-status-soft-bounce">
          <Trans>
            The copied signature is {stale} min old: Svix verifiers (the Resend SDK) reject
            timestamps older than 5 minutes, and receivers may deduplicate on the delivery id.
          </Trans>
        </p>
      )}
      {replay.isError && (
        <p role="alert" className="m-0 text-xs text-ms-danger">
          <Trans>Replay refused: {replay.error.message}</Trans>
        </p>
      )}
      {sent && (
        <p role="status" className="m-0 flex flex-wrap items-center gap-2 text-xs">
          <Trans>Replay queued as</Trans>
          <Button variant="link" className="font-mono text-xs" onClick={() => onOpen(sent.id)}>
            {sent.id}
          </Button>
        </p>
      )}
    </div>
  )
}
