import type { DeliveryStatus } from '@mailsink/contracts'
import {
  type Database,
  enqueueJobs,
  listRecipientsForSimulation,
  lockMessage,
  type MessageEventRow,
  type SimulatedRecipient,
  setMessageSimulation,
  setMessageStatus,
} from '@mailsink/db'
import type { EngagementOptions } from '../events-api/engagement'
import type { FannedOut } from '../webhooks/fanout'
import { aggregateStatus } from './aggregate'
import { fanOutRun } from './fan-out-run'
import type { DeliveryPlanner, PlanRecipient } from './planner'
import { createRecorder, type RecipientTransition } from './recorder'
import { randomSeed } from './rng'
import { settingsPlanner } from './settings-planner'
import { isPending, readSnapshot } from './snapshot'

export type { RecipientTransition } from './recorder'

/** D72: a deferred recipient is decided again after 1 s plus a new delay. */
export const DEFERRED_RETRY_MS = 1000
/** D72: past 3 deferrals, a 4th `deferred` ends as a `soft_bounce`. */
export const MAX_DEFERRALS = 3

export interface SimulateDeliveryOptions {
  /** Default: the settings planner (resolver, rules, weighted draw, #21). */
  planner?: DeliveryPlanner
  now?: () => number
  /** Fixed seed for new messages (tests); random by default, stored in the snapshot. */
  seed?: number
  deferredRetryMs?: number
  maxDeferrals?: number
  /** Draws of the automatic opened / clicked events (#34). */
  engagement?: EngagementOptions
}

export type SimulationResult =
  | { kind: 'missing' }
  | {
      kind: 'done'
      messageStatus: DeliveryStatus | undefined
      /** Connection of the message (stream filter of the published frames). */
      connectionId: string | null
      /** In write order, each with the id of its `message_events` row. */
      transitions: RecipientTransition[]
      /** The `message_events` rows written by the run, in write order: what the job handler
       * publishes on the event bus without reading them back (D95). */
      events: MessageEventRow[]
      /** Automatic opened / clicked rows written after the run's events, same transaction. */
      engagement: MessageEventRow[]
      /** Webhook deliveries created by the run, same transaction (D152). */
      deliveries: FannedOut[]
      /** Addresses added to the suppression list by this run. */
      suppressed: string[]
      /** When the follow-up job runs (a decision is still pending), else null. */
      nextRunAt: Date | null
    }

const IN_FLIGHT = new Set(['sent', 'deferred'])

/**
 * One run of the `simulate_delivery` job, in one transaction with the message row locked:
 * 1. `queued` recipients are decided (planner) and move to `sent`;
 * 2. decisions whose delay is over get their final status (`hard_bounce` and `complained`
 *    join the suppression list);
 * 3. recipients that just went `deferred` are decided again for later;
 * 4. the decisions go to `messages.simulation`, the aggregate to `messages.status`, and a
 *    follow-up job is enqueued at the earliest pending decision;
 * 5. automatic opened / clicked events and the webhook fan-out of every written event
 *    (D152), so the deliveries commit with the run.
 * A replay finds nothing queued nor due and writes nothing, so the handler is idempotent.
 */
export async function simulateDelivery(
  db: Database,
  messageId: string,
  options: SimulateDeliveryOptions = {},
): Promise<SimulationResult> {
  const planner = options.planner ?? settingsPlanner
  const now = (options.now ?? Date.now)()
  const retryMs = options.deferredRetryMs ?? DEFERRED_RETRY_MS
  const maxDeferrals = options.maxDeferrals ?? MAX_DEFERRALS
  return db.transaction(async (tx) => {
    const message = await lockMessage(tx, messageId)
    if (!message) return { kind: 'missing' }
    const recipients = await listRecipientsForSimulation(tx, messageId)
    const snapshot = readSnapshot(message.simulation, () => options.seed ?? randomSeed())
    const recorder = createRecorder(tx, message, now)
    const rows = new Map(recipients.map((r) => [r.id, r]))
    let changed = false

    const decide = async (batch: PlanRecipient[], delayFloor: number) => {
      if (batch.length === 0) return
      const byId = new Map(batch.map((r) => [r.id, r]))
      const plan = await planner({ message, recipients: batch, seed: snapshot.seed, now }, tx)
      Object.assign(snapshot, plan.context)
      for (const o of plan.outcomes) {
        const r = byId.get(o.recipientId)
        if (!r) continue
        const delayMs = delayFloor + (o.delayMs ?? 0)
        snapshot.recipients[r.email] = {
          ...o.detail,
          status: o.status,
          ...(o.reason ? { reason: o.reason } : {}),
          ...(o.smtpCode ? { smtpCode: o.smtpCode } : {}),
          delayMs,
          attempt: r.attempt,
          decidedAt: new Date(now).toISOString(),
          dueAt: new Date(now + delayMs).toISOString(),
        }
        const row = rows.get(r.id)
        if (row?.status === 'queued') await recorder.record(row, 'sent')
        changed = true
      }
    }

    await decide(
      recipients.filter((r) => r.status === 'queued').map((r) => ({ ...r, attempt: 0 })),
      0,
    )

    const requeue: PlanRecipient[] = []
    for (const r of recipients) {
      const entry = snapshot.recipients[r.email]
      if (!IN_FLIGHT.has(r.status) || !isPending(entry) || Date.parse(entry.dueAt) > now) continue
      const exhausted = entry.status === 'deferred' && entry.attempt >= maxDeferrals
      const status = exhausted ? 'soft_bounce' : entry.status
      const reason = exhausted ? `deferred ${entry.attempt} times` : entry.reason
      await recorder.record(r, status, { reason, smtpCode: entry.smtpCode })
      entry.appliedAt = new Date(now).toISOString()
      if (exhausted) entry.status = status
      if (status === 'deferred') requeue.push({ ...r, attempt: entry.attempt + 1 })
      changed = true
    }
    await decide(requeue, retryMs)

    const suppressed = await recorder.flush()
    const messageStatus = aggregateStatus(recipients.map((r) => r.status))
    if (messageStatus && messageStatus !== message.status) {
      await setMessageStatus(tx, messageId, messageStatus)
    }
    if (changed) await setMessageSimulation(tx, messageId, snapshot)

    const nextRunAt = nextDue(recipients, snapshot.recipients)
    if (nextRunAt) {
      await enqueueJobs(tx, [
        {
          kind: 'simulate_delivery',
          workspaceId: message.workspaceId,
          payload: { messageId },
          runAt: nextRunAt,
        },
      ])
    }
    const { engagement, deliveries } = await fanOutRun(
      tx,
      message.workspaceId,
      message.connectionId,
      recorder.events,
      options.engagement,
    )
    return {
      kind: 'done',
      messageStatus,
      connectionId: message.connectionId,
      transitions: recorder.transitions,
      events: recorder.events,
      engagement,
      deliveries,
      suppressed,
      nextRunAt,
    }
  })
}

/** Earliest pending decision of an in-flight recipient, if any. */
function nextDue(
  recipients: readonly SimulatedRecipient[],
  entries: ReturnType<typeof readSnapshot>['recipients'],
): Date | null {
  let next: number | null = null
  for (const r of recipients) {
    const entry = entries[r.email]
    if (!IN_FLIGHT.has(r.status) || !isPending(entry)) continue
    const due = Date.parse(entry.dueAt)
    if (next === null || due < next) next = due
  }
  return next === null ? null : new Date(next)
}
