import type { DeliveryStatus, EventOrigin, TriggerEventRequest } from '@mailsink/contracts'
import {
  addSuppressions,
  type Database,
  insertMessageEvents,
  listRecipientsForSimulation,
  lockMessage,
  type MessageEventRow,
  newId,
  type SimulatedRecipient,
  setMessageStatus,
  setRecipientsStatus,
} from '@mailsink/db'
import { DomainError } from '../errors'
import { aggregateStatus } from '../simulation/aggregate'
import { type FannedOut, fanOutEvents } from '../webhooks/fanout'

export interface TriggeredEvents {
  events: MessageEventRow[]
  deliveries: FannedOut[]
  connectionId: string | null
  /** New aggregated status when a forced status changed it, else undefined. */
  messageStatus: DeliveryStatus | undefined
}

const SUPPRESSING = new Set(['hard_bounce', 'complained'])

function targetsOf(recipients: SimulatedRecipient[], recipient: string | undefined) {
  if (recipient === undefined) {
    const active = recipients.filter((r) => r.status !== 'suppressed')
    if (active.length === 0) throw new DomainError('conflict', 'Every recipient is suppressed')
    return active
  }
  const email = recipient.toLowerCase()
  const found = recipients.filter((r) => r.email === email)
  if (found.length === 0) throw new DomainError('not_found', 'Recipient not found')
  if (found.every((r) => r.status === 'suppressed')) {
    throw new DomainError('conflict', 'This recipient is suppressed')
  }
  return found
}

/**
 * `POST /capture/messages/:id/events` (#34): one event per targeted recipient (every
 * recipient not suppressed when `recipient` is omitted). `opened` / `clicked` only add the
 * event; a forced `status` (B1-1) also updates the recipient status, the message aggregate
 * and the suppression list (`hard_bounce`, `complained`, like the simulation). Webhooks fan
 * out in the same transaction (D24).
 */
export async function triggerMessageEvent(
  db: Database,
  workspaceId: string,
  messageId: string,
  request: TriggerEventRequest,
  origin: EventOrigin = 'api',
  now: number = Date.now(),
): Promise<TriggeredEvents> {
  return db.transaction(async (tx) => {
    const message = await lockMessage(tx, messageId)
    if (!message || message.workspaceId !== workspaceId) {
      throw new DomainError('not_found', 'Message not found')
    }
    const recipients = await listRecipientsForSimulation(tx, messageId)
    const targets = targetsOf(recipients, request.recipient)
    const type = request.type === 'status' ? request.status : request.type
    const data =
      request.type === 'status'
        ? request.reason
          ? { reason: request.reason }
          : null
        : {
            ...(request.type === 'clicked' ? { url: request.url } : {}),
            ...(request.userAgent ? { userAgent: request.userAgent } : {}),
          }
    const events: MessageEventRow[] = targets.map((r, i) => ({
      id: newId('evt', now + i),
      workspaceId,
      messageId,
      recipientEmail: r.email,
      type,
      origin,
      data: data && Object.keys(data).length > 0 ? data : null,
      occurredAt: new Date(now + i),
    }))
    await insertMessageEvents(tx, events)

    let messageStatus: DeliveryStatus | undefined
    if (request.type === 'status') {
      await setRecipientsStatus(
        tx,
        targets.map((r) => r.id),
        request.status,
        request.reason ?? null,
      )
      for (const r of targets) r.status = request.status
      if (SUPPRESSING.has(request.status)) {
        await addSuppressions(
          tx,
          targets.map((r) => ({
            id: newId('sup'),
            workspaceId,
            email: r.email,
            reason: request.status as 'hard_bounce' | 'complained',
            messageId,
          })),
        )
      }
      const aggregated = aggregateStatus(recipients.map((r) => r.status))
      if (aggregated && aggregated !== message.status) {
        await setMessageStatus(tx, messageId, aggregated)
        messageStatus = aggregated
      }
    }
    const deliveries = await fanOutEvents(tx, workspaceId, events)
    return { events, deliveries, connectionId: message.connectionId, messageStatus }
  })
}
