import {
  BrevoWebhookPayload,
  ResendWebhookPayload,
  UnifiedWebhookPayload,
} from '@mailsink/contracts'
import { z } from 'zod'
import type { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from 'zod-openapi'

const accepted = { '2XX': { description: 'Any 2xx acknowledges the delivery.' } }

function outgoing(
  operationId: string,
  summary: string,
  schema: z.ZodType,
  headers: z.ZodObject,
): { post: ZodOpenApiOperationObject } {
  return {
    post: {
      operationId,
      summary,
      tags: ['Outgoing webhooks'],
      requestParams: { header: headers },
      requestBody: { required: true, content: { 'application/json': { schema } } },
      responses: accepted,
      // Signed with the endpoint secret (headers below), no Mailsink credential.
      security: [],
    },
  }
}

/**
 * What Mailsink POSTs to a webhook endpoint, per `payloadFormat` (03-contracts,
 * « Formatter strategy », D21). Failed attempts are retried (D24).
 */
export const OUTGOING_WEBHOOKS: ZodOpenApiPathsObject = {
  unified: outgoing(
    'unifiedWebhook',
    'Unified format (`payloadFormat: unified`)',
    UnifiedWebhookPayload,
    z.object({
      'X-Mailsink-Event': z.string().meta({ description: 'Canonical event name.' }),
      'X-Mailsink-Delivery-Id': z.string().meta({ description: 'Delivery id (`whd_…`).' }),
      'X-Mailsink-Timestamp': z.string().meta({ description: 'Unix seconds, signed.' }),
      'X-Mailsink-Signature': z.string().meta({
        description: '`sha256=<hex hmac_sha256(secret, "<timestamp>.<body>")>`.',
      }),
    }),
  ),
  resend: outgoing(
    'resendWebhook',
    'Resend format, signed as Svix (`payloadFormat: resend`)',
    ResendWebhookPayload,
    z.object({
      'svix-id': z.string(),
      'svix-timestamp': z.string(),
      'svix-signature': z.string().meta({ description: '`v1,<base64 signature>`.' }),
    }),
  ),
  brevo: outgoing(
    'brevoWebhook',
    'Brevo format (`payloadFormat: brevo`), with the endpoint auth and custom headers',
    BrevoWebhookPayload,
    z.object({}),
  ),
}
