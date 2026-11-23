import type { PayloadFormat } from '@mailsink/contracts'

// Payload formats of the prototype « Format » menu: brand names (not translated), colour
// token, signature scheme and the headers it adds (03-contracts, « Webhooks »).

type FormatMeta = {
  label: string
  short: string
  /** Text colour class of the format swatch and badge. */
  tone: string
  signature: string
  headers: string
}

export const FORMATS: Record<PayloadFormat, FormatMeta> = {
  unified: {
    label: 'Mailsink Unified',
    short: 'Unified',
    tone: 'text-ms-accent-text',
    signature: 'X-Mailsink-Signature',
    headers: 'X-Mailsink-Signature: t=…,v1=…',
  },
  resend: {
    label: 'Resend',
    short: 'Resend',
    tone: 'text-ms-conn-resend',
    signature: 'Svix HMAC',
    headers: 'svix-id · svix-timestamp · svix-signature',
  },
  brevo: {
    label: 'Brevo',
    short: 'Brevo',
    tone: 'text-ms-conn-brevo',
    signature: 'Bearer / Basic',
    headers: 'Authorization',
  },
}

export const FORMAT_ORDER: readonly PayloadFormat[] = ['unified', 'resend', 'brevo']

/** Formats that sign with a `whsec_` secret (Brevo uses its own auth instead, D136). */
export const hasSigningSecret = (format: PayloadFormat) => format !== 'brevo'
