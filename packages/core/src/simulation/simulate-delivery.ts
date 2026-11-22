import type { DeliveryStatus } from '@mailsink/contracts'
import {
  type Database,
  insertMessageEvents,
  listRecipientsForSimulation,
  lockMessage,
  type NewMessageEventRow,
  newId,
  setMessageStatus,
  setRecipientsStatus,
} from '@mailsink/db'
import { aggregateStatus } from './aggregate'
import { baselinePlanner, type DeliveryPlanner, type RecipientOutcome } from './planner'

export interface SimulateDeliveryOptions {
  planner?: DeliveryPlanner
  now?: () => number
}

export interface RecipientTransition {
  recipientId: string
  email: string
  status: RecipientOutcome['status']
}

export type SimulationResult =
  | { kind: 'missing' }
  | { kind: 'done'; messageStatus: DeliveryStatus | undefined; transitions: RecipientTransition[] }

/**
 * Moves every `queued` recipient of the message through `sent` to its planned final status,
 * writing one `sent` and one final event per recipient (origin `simulation`), then stores
 * the aggregated message status. One transaction with the message row locked: replaying
 * the job (expired lease, crash before the job row was deleted) finds no `queued`
 * recipient left and changes nothing, so the handler is idempotent.
 */
export async function simulateDelivery(
  db: Database,
  messageId: string,
  options: SimulateDeliveryOptions = {},
): Promise<SimulationResult> {
  const planner = options.planner ?? baselinePlanner
  const now = options.now ?? Date.now
  return db.transaction(async (tx) => {
    const message = await lockMessage(tx, messageId)
    if (!message) return { kind: 'missing' }
    const recipients = await listRecipientsForSimulation(tx, messageId)
    const queued = recipients.filter((r) => r.status === 'queued')
    const outcomes = queued.length > 0 ? await planner({ message, recipients: queued }, tx) : []

    const byId = new Map(queued.map((r) => [r.id, r]))
    const transitions: RecipientTransition[] = []
    const events: NewMessageEventRow[] = []
    // Explicit, strictly increasing times (and ids) keep `sent` before the final event,
    // where the transaction-wide now() would give them the same timestamp.
    const sentAt = now()
    for (const outcome of outcomes) {
      const recipient = byId.get(outcome.recipientId)
      if (!recipient) continue
      const base = { workspaceId: message.workspaceId, messageId, recipientEmail: recipient.email }
      const data = outcome.reason ? { reason: outcome.reason } : null
      events.push(
        {
          ...base,
          id: newId('evt', sentAt),
          type: 'sent',
          origin: 'simulation',
          occurredAt: new Date(sentAt),
        },
        {
          ...base,
          id: newId('evt', sentAt + 1),
          type: outcome.status,
          origin: 'simulation',
          data,
          occurredAt: new Date(sentAt + 1),
        },
      )
      await setRecipientsStatus(tx, [recipient.id], outcome.status, outcome.reason ?? null)
      transitions.push({
        recipientId: recipient.id,
        email: recipient.email,
        status: outcome.status,
      })
    }
    await insertMessageEvents(tx, events)

    const done = new Map(transitions.map((t) => [t.recipientId, t.status]))
    const statuses = recipients.map((r) => done.get(r.id) ?? r.status)
    const messageStatus = aggregateStatus(statuses)
    if (messageStatus && messageStatus !== message.status) {
      await setMessageStatus(tx, messageId, messageStatus)
    }
    return { kind: 'done', messageStatus, transitions }
  })
}
