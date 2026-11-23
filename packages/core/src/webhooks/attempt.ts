import {
  type Database,
  enqueueJobs,
  findDeliveryWithEndpoint,
  findWebhookAttempt,
  insertWebhookAttempt,
  newId,
  updateWebhookDelivery,
  type WebhookAttempt,
  type WebhookDelivery,
  type WebhookEndpoint,
} from '@mailsink/db'
import type { Random } from '../simulation/rng'
import { endpointSecrets } from './context'
import { formatters } from './formatters'
import { type DeliverWebhookPayload, deliverWebhookJob } from './jobs'
import { WEBHOOK_MAX_ATTEMPTS, webhookRetryDelayMs } from './retry'
import { type FetchLike, isSuccess, type SendResult, sendWebhook } from './send'
import type { UrlGuard } from './url-guard'

export interface AttemptOptions {
  fetch?: FetchLike
  now?: () => number
  /** Jitter source of the retry delay. */
  random?: Random
  timeoutMs?: number
  maxAttempts?: number
  /** false: a failed attempt is final (test send). */
  retry?: boolean
  /** Refuses private destinations before sending; a refusal is final (D150, D155). */
  urlGuard?: UrlGuard
}

export interface AttemptOutcome {
  delivery: WebhookDelivery
  endpoint: WebhookEndpoint
  attempt: WebhookAttempt
}

/** Id the receiver sees (svix-id, X-Mailsink-Delivery-Id): a replay keeps the original's. */
export const signingId = (d: Pick<WebhookDelivery, 'id' | 'replayOf'>) => d.replayOf ?? d.id

/**
 * One attempt (D24, step 3): signs the stored body with this attempt's timestamp (or, for
 * an `exact` replay, reuses the copied headers), POSTs it, stores the exact headers sent,
 * then marks the delivery succeeded, failed, or retrying with its next job. Returns null
 * when the attempt was already made (job replayed) or the delivery is gone.
 */
export async function runAttempt(
  db: Database,
  payload: DeliverWebhookPayload,
  options: AttemptOptions = {},
): Promise<AttemptOutcome | null> {
  const found = await findDeliveryWithEndpoint(db, payload.deliveryId)
  if (!found) return null
  const { delivery, endpoint } = found
  if (delivery.status === 'succeeded' || delivery.status === 'failed') return null
  if (delivery.attemptCount >= payload.attemptNo) return null

  const now = (options.now ?? Date.now)()
  let headers: Record<string, string>
  let signedAt: number | null = Math.floor(now / 1000)
  let signError: string | null = null
  const copied = payload.exactAttemptId
    ? await findWebhookAttempt(db, payload.exactAttemptId)
    : undefined
  if (copied) {
    headers = copied.requestHeaders
    signedAt = copied.signedAt
  } else {
    try {
      headers = formatters[delivery.payloadFormat].sign({
        deliveryId: signingId(delivery),
        body: delivery.body,
        endpoint: endpointSecrets(endpoint),
        timestamp: signedAt,
        canonical: delivery.canonicalEvent,
      })
    } catch (error) {
      headers = {}
      signError = error instanceof Error ? error.message : String(error)
    }
  }
  const refused = signError ? null : ((await options.urlGuard?.(endpoint.url)) ?? null)
  const failure = signError ?? refused
  const sent: SendResult = failure
    ? { status: null, body: null, durationMs: 0, error: failure }
    : await sendWebhook(endpoint.url, headers, delivery.body, options)

  const maxAttempts = options.retry === false ? 1 : (options.maxAttempts ?? WEBHOOK_MAX_ATTEMPTS)
  const ok = isSuccess(sent.status)
  const final = ok || refused !== null || payload.attemptNo >= maxAttempts
  const nextAt = final
    ? null
    : new Date(now + webhookRetryDelayMs(payload.attemptNo, options.random))
  return db.transaction(async (tx) => {
    const attempt = await insertWebhookAttempt(tx, {
      id: newId('wha'),
      deliveryId: delivery.id,
      attemptNo: payload.attemptNo,
      requestHeaders: headers,
      signedAt,
      responseStatus: sent.status,
      responseBody: sent.body,
      durationMs: sent.durationMs,
      error: sent.error,
    })
    const updated = await updateWebhookDelivery(tx, delivery.id, {
      attemptCount: payload.attemptNo,
      lastStatusCode: sent.status,
      status: ok ? 'succeeded' : final ? 'failed' : 'retrying',
      nextAttemptAt: nextAt,
    })
    if (nextAt) {
      await enqueueJobs(tx, [
        deliverWebhookJob(delivery, {
          ...payload,
          attemptNo: payload.attemptNo + 1,
          runAt: nextAt,
        }),
      ])
    }
    return { delivery: updated ?? delivery, endpoint, attempt }
  })
}
