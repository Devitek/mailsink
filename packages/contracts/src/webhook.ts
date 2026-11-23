import { z } from 'zod'
import { IsoDateTime } from './common'
import { ConnectionId, WebhookEndpointId } from './ids'
import { CanonicalEvent, type ConnectionKind } from './status'

// Outgoing webhooks (03-contracts, « Webhooks », D20 to D24). Event names are accepted in
// the dialect of `payloadFormat` (or canonical) and stored canonical; core maps them.

export const PayloadFormat = z.enum(['unified', 'resend', 'brevo'])

export const BrevoAuth = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('bearer'), token: z.string().min(1).max(500) }),
  z.object({
    type: z.literal('basic'),
    username: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[^:]*$/, 'The username cannot contain ":"'),
    password: z.string().max(500),
  }),
])

export const CustomHeader = z.object({
  key: z.string().regex(/^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,100}$/, 'Invalid header name'),
  value: z.string().max(1000),
})

const WebhookUrl = z.url({ protocol: /^https?$/ }).max(2000)
const EventNames = z.array(z.string().min(1).max(100)).min(1).max(50)

export const WebhookEndpointInput = z.object({
  connectionId: ConnectionId.nullable(), // null = Workspace scope
  url: WebhookUrl,
  payloadFormat: PayloadFormat.optional(), // default: defaultPayloadFormat(scope)
  events: EventNames,
  description: z.string().max(200).optional(),
  brevoAuth: BrevoAuth.optional(), // brevo format only
  customHeaders: z.array(CustomHeader).max(10).optional(),
  enabled: z.boolean().optional(),
})

/** PATCH: every field optional; `rotateSecret: true` issues a new `whsec_` secret. */
export const WebhookEndpointPatch = z.object({
  connectionId: ConnectionId.nullable().optional(),
  url: WebhookUrl.optional(),
  payloadFormat: PayloadFormat.optional(),
  events: EventNames.optional(),
  description: z.string().max(200).nullable().optional(),
  brevoAuth: BrevoAuth.optional(),
  customHeaders: z.array(CustomHeader).max(10).optional(),
  enabled: z.boolean().optional(),
  rotateSecret: z.literal(true).optional(),
})

/** Creation default (D20): connection kind for resend/brevo, else unified. */
export function defaultPayloadFormat(scope: { kind: ConnectionKind } | null): PayloadFormat {
  return scope && scope.kind !== 'smtp' ? scope.kind : 'unified'
}

export const WebhookEndpointView = z.object({
  id: WebhookEndpointId,
  numericId: z.number().int(), // Brevo payload `id`
  connectionId: ConnectionId.nullable(),
  url: z.string(),
  payloadFormat: PayloadFormat,
  events: z.array(z.string()), // dialect names of payloadFormat, deduplicated
  canonicalEvents: z.array(CanonicalEvent),
  unsupportedEvents: z.array(CanonicalEvent), // stored, never emitted by this format
  description: z.string().nullable(),
  // Credentials are never returned: only the type (and the basic auth username).
  brevoAuth: z.object({
    type: z.enum(['none', 'bearer', 'basic']),
    username: z.string().optional(),
  }),
  customHeaders: z.array(CustomHeader),
  secretPreview: z.string().nullable(),
  enabled: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
})

/** Creation and rotation answer the clear secret once (unified and resend formats). */
export const WebhookEndpointWithSecret = WebhookEndpointView.extend({
  secret: z.string().nullable(),
})

export const ListWebhookEndpointsQuery = z.object({ connectionId: ConnectionId.optional() })
export const ListWebhookEndpointsResponse = z.object({ data: z.array(WebhookEndpointView) })

export const WebhookPreviewRequest = z.object({
  payloadFormat: PayloadFormat,
  event: z.string().min(1).max(100), // dialect or canonical name
  connectionId: ConnectionId.optional(),
})
export const WebhookPreviewResponse = z.object({
  body: z.string(),
  headers: z.record(z.string(), z.string()), // secret-derived values masked
})

/** `POST /capture/webhooks/:id/test`: one signed sample event (default email.delivered). */
export const WebhookTestRequest = z.object({ event: z.string().min(1).max(100).optional() })

export type PayloadFormat = z.output<typeof PayloadFormat>
export type BrevoAuth = z.output<typeof BrevoAuth>
export type CustomHeader = z.output<typeof CustomHeader>
export type WebhookEndpointInput = z.output<typeof WebhookEndpointInput>
export type WebhookEndpointPatch = z.output<typeof WebhookEndpointPatch>
export type WebhookEndpointView = z.output<typeof WebhookEndpointView>
export type WebhookEndpointWithSecret = z.output<typeof WebhookEndpointWithSecret>
export type ListWebhookEndpointsQuery = z.output<typeof ListWebhookEndpointsQuery>
export type WebhookPreviewRequest = z.output<typeof WebhookPreviewRequest>
export type WebhookPreviewResponse = z.output<typeof WebhookPreviewResponse>
export type WebhookTestRequest = z.output<typeof WebhookTestRequest>
