import type {
  WebhookDeliveryStatus,
  WebhookEndpointView,
  WebhookEndpointWithSecret,
} from '@mailsink/contracts'

// Shapes of the webhook endpoint server functions of the settings screen (#43).

export type LastDelivery = {
  status: WebhookDeliveryStatus
  statusCode: number | null
  createdAt: string
}

export type EndpointRow = WebhookEndpointView & { lastDelivery: LastDelivery | null }

/** A refusal of the core validation, on the field it concerns (`url`, `customHeaders.0.key`). */
export type FieldIssue = { path: string; code: string; message: string }

export type EndpointSaved =
  | { ok: true; endpoint: WebhookEndpointWithSecret }
  | { ok: false; issues: FieldIssue[] }

/** Outcome of a « Test send »: the single attempt, never retried (D140). */
export type TestSendResult = {
  deliveryId: string
  status: WebhookDeliveryStatus
  statusCode: number | null
  durationMs: number | null
  error: string | null
  event: string
}
