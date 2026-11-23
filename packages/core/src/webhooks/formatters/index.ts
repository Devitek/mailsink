import type { PayloadFormat } from '@mailsink/contracts'
import { brevoFormatter } from './brevo'
import { resendFormatter } from './resend'
import type { WebhookFormatter } from './types'
import { unifiedFormatter } from './unified'

export const formatters: Record<PayloadFormat, WebhookFormatter> = {
  unified: unifiedFormatter,
  resend: resendFormatter,
  brevo: brevoFormatter,
}

export { brevoDate, brevoFormatter } from './brevo'
export * from './events-map'
export { resendFormatter, svixSignature } from './resend'
export type * from './types'
export { unifiedFormatter, unifiedSignature } from './unified'
