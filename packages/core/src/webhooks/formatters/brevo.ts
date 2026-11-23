import type { BrevoWebhookPayload } from '@mailsink/contracts'
import { toDialect } from './events-map'
import { JSON_CONTENT_TYPE, messageUuid, unixSeconds, withCustomHeaders } from './shared'
import type { EndpointSecrets, MessageForWebhook, WebhookFormatter } from './types'

type BrevoEvent = BrevoWebhookPayload['event']

/** `YYYY-MM-DD HH:mm:ss` in `timeZone` (UTC when the zone is unknown), D23. */
export function brevoDate(date: Date, timeZone: string): string {
  let format: Intl.DateTimeFormat
  try {
    format = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return brevoDate(date, 'UTC')
  }
  const p = Object.fromEntries(format.formatToParts(date).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`
}

/** Brevo message ids look like `<…@smtp-relay.mailin.fr>`; Brevo ingestion keeps its own. */
function brevoMessageId(message: MessageForWebhook): string {
  if (/^<.+@.+>$/.test(message.providerMessageId)) return message.providerMessageId
  return `<${messageUuid(message)}@smtp-relay.mailin.fr>`
}

/** Brevo signs nothing (D23): the receiver authenticates with bearer or basic auth. */
function authorization(endpoint: EndpointSecrets): Record<string, string> {
  if (endpoint.brevoAuth === 'none' || !endpoint.secret) return {}
  if (endpoint.brevoAuth === 'bearer') return { Authorization: `Bearer ${endpoint.secret}` }
  return { Authorization: `Basic ${Buffer.from(endpoint.secret).toString('base64')}` }
}

const WITH_REASON = new Set(['soft_bounce', 'hard_bounce', 'deferred', 'blocked'])

export const brevoFormatter: WebhookFormatter = {
  format: 'brevo',
  eventName: (canonical) => toDialect('brevo', canonical),
  serialize({ delivery, workspace, message, event }) {
    const name = toDialect('brevo', event.canonical) as BrevoEvent | null
    if (!name) throw new Error(`brevo cannot emit ${event.canonical}`)
    const seconds = unixSeconds(event.occurredAt)
    const tags = message.tags.map((t) => t.value || t.name)
    const payload: BrevoWebhookPayload = {
      event: name,
      email: event.recipient ?? message.to[0] ?? '',
      id: delivery.numericEndpointId,
      date: brevoDate(event.occurredAt, workspace.timezone),
      ts: seconds,
      ts_event: seconds,
      ts_epoch: event.occurredAt.getTime(),
      'message-id': brevoMessageId(message),
      subject: message.subject,
    }
    if (tags.length > 0) {
      payload.tag = tags[0]
      payload.tags = tags
    }
    if (message.templateId !== null) payload.template_id = message.templateId
    const custom = message.metadata['X-Mailin-custom']
    if (typeof custom === 'string') payload['X-Mailin-custom'] = custom
    if (name === 'click' && event.detail.url) payload.link = event.detail.url
    if (WITH_REASON.has(name) && event.detail.reason) payload.reason = event.detail.reason
    payload.source = message.source === 'smtp' ? 'SMTP' : 'API'
    return JSON.stringify(payload)
  },
  sign({ endpoint }) {
    return withCustomHeaders(endpoint, {
      'Content-Type': JSON_CONTENT_TYPE,
      ...authorization(endpoint),
    })
  },
}
