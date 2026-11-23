import type {
  CanonicalEvent,
  PayloadFormat,
  WebhookDeliveryDetail,
  WebhookPreviewRequest,
  WebhookPreviewResponse,
} from '@mailsink/contracts'
import {
  type Database,
  type Executor,
  findConnectionKind,
  findWebhookEndpoint,
  findWebhookWorkspace,
  insertWebhookDeliveries,
  listWebhookAttempts,
  newId,
} from '@mailsink/db'
import { DomainError } from '../errors'
import type { EventBus } from '../events/bus'
import { type AttemptOptions, runAttempt } from './attempt'
import { formatters } from './formatters'
import { toCanonical } from './formatters/events-map'
import { publishDeliveries } from './publish'
import { sampleContext } from './sample'
import { generateWebhookSecret } from './secret'
import { toDeliveryDetail } from './views'

// Preview and test send (B1-2): a sample message, the real formatter.

/** The single canonical event a name stands for in `format`, emitted by that format. */
function sampleEvent(format: PayloadFormat, name: string): CanonicalEvent {
  const canonical = toCanonical(format, name)[0]
  if (!canonical || formatters[format].eventName(canonical) === null) {
    throw new DomainError('validation_error', `The ${format} format cannot emit "${name}"`, {
      details: {
        in: 'body',
        issues: [
          {
            path: ['event'],
            code: 'custom',
            message: `Unknown or unsupported ${format} event "${name}"`,
            params: { code: 'unknown_webhook_event' },
          },
        ],
      },
    })
  }
  return canonical
}

async function workspaceOf(db: Executor, workspaceId: string) {
  const workspace = await findWebhookWorkspace(db, workspaceId)
  if (!workspace) throw new DomainError('not_found', 'Workspace not found')
  return workspace
}

const MASK = '••••••••'

/** Secret-derived header values hidden (the preview is not tied to a real secret). */
function maskHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    const k = key.toLowerCase()
    if (k === 'x-mailsink-signature') out[key] = `sha256=${MASK}`
    else if (k === 'svix-signature') out[key] = `v1,${MASK}`
    else if (k === 'authorization') out[key] = `${value.split(' ')[0]} ${MASK}`
    else out[key] = value
  }
  return out
}

/** `POST /capture/webhooks/preview`: body and headers the format would send. */
export async function previewWebhook(
  db: Executor,
  workspaceId: string,
  input: WebhookPreviewRequest,
  now: Date = new Date(),
): Promise<WebhookPreviewResponse> {
  const canonical = sampleEvent(input.payloadFormat, input.event)
  const workspace = await workspaceOf(db, workspaceId)
  const connection = input.connectionId
    ? ((await findConnectionKind(db, workspaceId, input.connectionId)) ?? null)
    : null
  if (input.connectionId && !connection) throw new DomainError('not_found', 'Connection not found')
  const formatter = formatters[input.payloadFormat]
  const deliveryId = newId('whd', now.getTime())
  const body = formatter.serialize(
    sampleContext({ canonical, deliveryId, numericEndpointId: 1, workspace, connection, now }),
  )
  const headers = formatter.sign({
    deliveryId,
    body,
    endpoint: { secret: generateWebhookSecret(), brevoAuth: 'none', customHeaders: [] },
    timestamp: Math.floor(now.getTime() / 1000),
    canonical,
  })
  return { body, headers: maskHeaders(headers) }
}

/**
 * `POST /capture/webhooks/:id/test`: one signed sample event in the endpoint's format,
 * logged as a delivery (no message, no event) and sent at once, without retries.
 */
export async function sendTestWebhook(
  db: Database,
  workspaceId: string,
  endpointId: string,
  event: string | undefined,
  options: AttemptOptions & { bus?: EventBus } = {},
): Promise<WebhookDeliveryDetail> {
  const endpoint = await findWebhookEndpoint(db, workspaceId, endpointId)
  if (!endpoint) throw new DomainError('not_found', 'Webhook endpoint not found')
  const format = endpoint.payloadFormat
  const canonical = sampleEvent(format, event ?? 'email.delivered')
  const workspace = await workspaceOf(db, workspaceId)
  const connection = endpoint.connectionId
    ? ((await findConnectionKind(db, workspaceId, endpoint.connectionId)) ?? null)
    : null
  const now = new Date((options.now ?? Date.now)())
  const id = newId('whd')
  const formatter = formatters[format]
  const ctx = sampleContext({
    canonical,
    deliveryId: id,
    numericEndpointId: endpoint.numericId,
    workspace,
    connection,
    now,
  })
  const [delivery] = await insertWebhookDeliveries(db, [
    {
      id,
      workspaceId,
      endpointId,
      payloadFormat: format,
      canonicalEvent: canonical,
      dialectEvent: formatter.eventName(canonical) ?? canonical,
      recipient: ctx.event.recipient,
      body: formatter.serialize(ctx),
    },
  ])
  if (!delivery) throw new Error('test delivery not inserted')
  const outcome = await runAttempt(
    db,
    { deliveryId: id, attemptNo: 1 },
    { ...options, retry: false },
  )
  const row = outcome?.delivery ?? delivery
  publishDeliveries(options.bus, workspaceId, [
    { delivery: row, connectionId: endpoint.connectionId },
  ])
  return toDeliveryDetail(row, await listWebhookAttempts(db, row.id))
}
