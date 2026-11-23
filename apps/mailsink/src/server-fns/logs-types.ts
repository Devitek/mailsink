import type {
  ApiLogDetail,
  ConnectionKind,
  PayloadFormat,
  WebhookAttemptView,
  WebhookDeliveryDetail,
} from '@mailsink/contracts'
import type { SignatureCheck } from './logs-signature'

// Shapes the logs explorer server functions return (serialisable, #41).

export interface LogConnection {
  id: string
  name: string
  kind: ConnectionKind
}

export interface LogEndpoint {
  id: string
  url: string
  payloadFormat: PayloadFormat
  /** Scope: a connection, or null for the whole workspace. */
  connectionId: string | null
}

/** What the toolbar needs: facet values and the count of each tab. */
export interface LogSources {
  connections: LogConnection[]
  endpoints: LogEndpoint[]
  counts: { api: number; smtp: number; webhooks: number }
}

/** Bodies as display text: JSON pretty-printed, text as stored, null when none. */
export type InspectedApiLog = Omit<ApiLogDetail, 'requestBody' | 'responseBody'> & {
  requestBody: string | null
  responseBody: string | null
}

export type InspectedAttempt = WebhookAttemptView & { signature: SignatureCheck }

export type InspectedDelivery = Omit<WebhookDeliveryDetail, 'attempts'> & {
  attempts: InspectedAttempt[]
  endpoint: (LogEndpoint & { secretPreview: string | null }) | null
}
