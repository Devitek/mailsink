import { Trans, useLingui } from '@lingui/react/macro'
import { SheetBody } from '@mailsink/ui'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { LogConnection } from '../../server-fns/logs-types'
import { AttemptCard } from './attempt-card'
import { DELIVERY_TONE } from './format'
import { CodeBlock, InspectorHeader, MessageLinks, Section } from './inspector-parts'
import { InspectorState } from './inspector-state'
import { CodeBadge, TypeBadge } from './log-badges'
import { deliveryQuery } from './queries'
import { ReplayPanel } from './replay-panel'
import { deliveryCode } from './webhook-columns'

function Field({ name, children }: Readonly<{ name: ReactNode; children: ReactNode }>) {
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-[13px] border-b border-ms-border px-4 py-[9px] text-xs last:border-b-0">
      <dt className="text-ms-text-muted">{name}</dt>
      <dd className="m-0 font-mono break-all">{children}</dd>
    </div>
  )
}

// Webhook delivery inspector (#41, owner's precision of #47): payload format, canonical and
// dialect event, the replay box, every attempt with its exact headers and signature check,
// then the exact body sent by every attempt.
export function WebhookInspector({
  slug,
  id,
  connections,
  onOpen,
}: Readonly<{
  slug: string
  id: string
  connections: readonly LogConnection[] | undefined
  onOpen: (id: string) => void
}>) {
  const { t } = useLingui()
  const { data: delivery, status } = useQuery(deliveryQuery(slug, id))
  if (!delivery) return <InspectorState status={status} />
  const scope = delivery.endpoint?.connectionId
  const connection = scope ? connections?.find((c) => c.id === scope)?.name : t`Workspace`
  return (
    <>
      <InspectorHeader
        badges={
          <>
            <TypeBadge kind="webhook" size="md">
              {delivery.payloadFormat}
            </TypeBadge>
            <CodeBadge tone={DELIVERY_TONE[delivery.status]} size="md">
              {deliveryCode(delivery)}
            </CodeBadge>
          </>
        }
        title={delivery.dialectEvent}
        id={delivery.id}
        extra={connection}
        at={delivery.createdAt}
      />
      <SheetBody className="flex flex-col gap-[23px] px-6 py-[22px]">
        <ReplayPanel key={delivery.id} slug={slug} delivery={delivery} onOpen={onOpen} />
        <Section title={<Trans>Event</Trans>}>
          <dl className="m-0 overflow-hidden rounded-md border border-ms-border bg-ms-bg">
            <Field name="payloadFormat">{delivery.payloadFormat}</Field>
            <Field name={<Trans>Canonical event</Trans>}>{delivery.canonicalEvent}</Field>
            <Field name={<Trans>Dialect event</Trans>}>{delivery.dialectEvent}</Field>
            {delivery.recipient && (
              <Field name={<Trans>Recipient</Trans>}>{delivery.recipient}</Field>
            )}
            {delivery.replayOf && (
              <Field name={<Trans>Replay of</Trans>}>
                {delivery.replayOf} ({delivery.replayMode})
              </Field>
            )}
            {delivery.nextAttemptAt && (
              <Field name={<Trans>Next attempt</Trans>}>{delivery.nextAttemptAt}</Field>
            )}
          </dl>
        </Section>
        <Section title={<Trans>Attempts · {delivery.attempts.length}</Trans>}>
          {delivery.attempts.length === 0 ? (
            <p className="m-0 text-xs text-ms-text-faint">
              <Trans>No attempt yet.</Trans>
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border border-ms-border">
              {delivery.attempts.map((attempt, index) => (
                <AttemptCard
                  key={attempt.id}
                  attempt={attempt}
                  secretPreview={delivery.endpoint?.secretPreview ?? null}
                  open={index === delivery.attempts.length - 1}
                />
              ))}
            </div>
          )}
        </Section>
        <Section title={<Trans>Payload sent · {delivery.contentType}</Trans>}>
          <CodeBlock tone="text">{delivery.body}</CodeBlock>
        </Section>
        <MessageLinks slug={slug} ids={delivery.messageId ? [delivery.messageId] : []} />
      </SheetBody>
    </>
  )
}
