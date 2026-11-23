import { randomBytes } from 'node:crypto'
import { KEY_PREFIXES } from '@mailsink/contracts'

/** `whsec_<base64 24 bytes>`: a Svix key for resend, the HMAC key for unified (D11). */
export function generateWebhookSecret(): string {
  return `${KEY_PREFIXES.webhook}${randomBytes(24).toString('base64')}`
}

/** Prefix plus 4 characters, enough to tell two secrets apart. */
export function webhookSecretPreview(secret: string): string {
  return `${secret.slice(0, KEY_PREFIXES.webhook.length + 4)}…`
}
