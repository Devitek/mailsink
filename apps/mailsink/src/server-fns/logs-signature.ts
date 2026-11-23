import type { CanonicalEvent, PayloadFormat } from '@mailsink/contracts'
import { type EndpointSecrets, formatters } from '@mailsink/core'

// Signature check of the webhook inspector (#41): signs the exact body again with the
// endpoint's current secret and the id and timestamp the attempt sent, then compares with
// the signature header it sent. A rotated secret makes older attempts `invalid`.

/** `unsigned`: Brevo without auth; `missing`: the attempt carries no signature header. */
export type SignatureCheck = 'valid' | 'invalid' | 'unsigned' | 'missing'

const SIGNED_HEADER: Record<PayloadFormat, string> = {
  unified: 'x-mailsink-signature',
  resend: 'svix-signature',
  brevo: 'authorization',
}
const ID_HEADER: Record<PayloadFormat, string | null> = {
  unified: 'x-mailsink-delivery-id',
  resend: 'svix-id',
  brevo: null,
}
const TIMESTAMP_HEADER: Record<PayloadFormat, string | null> = {
  unified: 'x-mailsink-timestamp',
  resend: 'svix-timestamp',
  brevo: null,
}

function header(headers: Record<string, string>, name: string | null): string | undefined {
  if (!name) return undefined
  return Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1]
}

export interface SignatureInput {
  payloadFormat: PayloadFormat
  canonicalEvent: CanonicalEvent
  body: string
  headers: Record<string, string>
  endpoint: EndpointSecrets
}

export function checkSignature(input: SignatureInput): SignatureCheck {
  const { payloadFormat: format, headers, endpoint } = input
  if (format === 'brevo' && (endpoint.brevoAuth === 'none' || !endpoint.secret)) {
    return header(headers, SIGNED_HEADER.brevo) ? 'invalid' : 'unsigned'
  }
  const sent = header(headers, SIGNED_HEADER[format])
  if (!sent) return 'missing'
  if (!endpoint.secret) return 'invalid'
  const timestamp = Number(header(headers, TIMESTAMP_HEADER[format]) ?? 0)
  const expected = formatters[format].sign({
    deliveryId: header(headers, ID_HEADER[format]) ?? '',
    body: input.body,
    endpoint: { ...endpoint, customHeaders: [] },
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    canonical: input.canonicalEvent,
  })
  return header(expected, SIGNED_HEADER[format]) === sent ? 'valid' : 'invalid'
}
