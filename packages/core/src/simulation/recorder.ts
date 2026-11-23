import type { DeliveryStatus } from '@mailsink/contracts'
import {
  addSuppressions,
  type Executor,
  insertMessageEvents,
  type NewMessageEventRow,
  type NewSuppression,
  newId,
  type SimulatedMessage,
  type SimulatedRecipient,
  setRecipientsStatus,
} from '@mailsink/db'

export interface RecipientTransition {
  recipientId: string
  email: string
  /** `sent` when the recipient leaves `queued`, then its final (or `deferred`) status. */
  status:
    | Extract<DeliveryStatus, 'sent'>
    | Exclude<DeliveryStatus, 'queued' | 'sent' | 'suppressed'>
  /** Id of the `message_events` row written for it (the SSE id, #26). */
  eventId: string
  occurredAt: Date
  reason?: string
  smtpCode?: number
}

const SUPPRESSING = new Set(['hard_bounce', 'complained'])

/**
 * Collects what one simulation run writes: recipient statuses (immediately), events and
 * suppressions (flushed at the end). Timestamps (and ids) strictly increase from `now`, so
 * `sent` sorts before the final event, where the transaction-wide now() would tie them.
 */
export function createRecorder(tx: Executor, message: SimulatedMessage, now: number) {
  let clock = now
  const events: NewMessageEventRow[] = []
  const suppressions: NewSuppression[] = []
  const transitions: RecipientTransition[] = []

  return {
    transitions,
    async record(
      recipient: SimulatedRecipient,
      status: RecipientTransition['status'],
      extra: { reason?: string; smtpCode?: number } = {},
    ): Promise<void> {
      const at = clock++
      const eventId = newId('evt', at)
      const data = {
        ...(extra.reason ? { reason: extra.reason } : {}),
        ...(extra.smtpCode ? { smtpCode: extra.smtpCode } : {}),
      }
      events.push({
        id: eventId,
        workspaceId: message.workspaceId,
        messageId: message.id,
        recipientEmail: recipient.email,
        type: status,
        origin: 'simulation',
        data: Object.keys(data).length > 0 ? data : null,
        occurredAt: new Date(at),
      })
      await setRecipientsStatus(tx, [recipient.id], status, extra.reason ?? null)
      recipient.status = status
      transitions.push({
        recipientId: recipient.id,
        email: recipient.email,
        status,
        eventId,
        occurredAt: new Date(at),
        ...extra,
      })
      if (SUPPRESSING.has(status)) {
        suppressions.push({
          id: newId('sup'),
          workspaceId: message.workspaceId,
          email: recipient.email,
          reason: status as 'hard_bounce' | 'complained',
          messageId: message.id,
        })
      }
    },
    /** Writes the events and suppressions; returns the addresses newly suppressed. */
    async flush(): Promise<string[]> {
      await insertMessageEvents(tx, events)
      const added = await addSuppressions(tx, suppressions)
      return added.map((s) => s.email)
    },
  }
}
