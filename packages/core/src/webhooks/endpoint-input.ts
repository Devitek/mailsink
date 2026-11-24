import type { BrevoAuth, CanonicalEvent, CustomHeader, PayloadFormat } from '@mailsink/contracts'
import { DomainError } from '../errors'
import { sortCanonical, toCanonical } from './formatters/events-map'
import { splitUrlCredentials } from './url-credentials'
import type { UrlGuard } from './url-guard'

// Validation of endpoint input beyond the Zod contract: the dialect of the event names
// depends on the resolved payload format (D20, D22).

function bodyError(code: string, message: string, path: (string | number)[]): DomainError {
  return new DomainError('validation_error', message, {
    details: { in: 'body', issues: [{ path, code: 'custom', message, params: { code } }] },
  })
}

/** Dialect (or canonical) names to the stored canonical events; unknown names are a 422. */
export function normalizeEvents(format: PayloadFormat, names: readonly string[]): CanonicalEvent[] {
  const events: CanonicalEvent[] = []
  names.forEach((name, index) => {
    const canonical = toCanonical(format, name)
    if (canonical.length === 0) {
      throw bodyError('unknown_webhook_event', `Unknown ${format} webhook event "${name}"`, [
        'events',
        index,
      ])
    }
    events.push(...canonical)
  })
  return sortCanonical(events)
}

/** Headers a custom header may not set: they carry the content type, auth or signature. */
const RESERVED = /^(content-type|content-length|host|authorization|svix-.*|x-mailsink-.*)$/i

export function checkCustomHeaders(headers: readonly CustomHeader[]): void {
  headers.forEach((h, index) => {
    if (RESERVED.test(h.key)) {
      throw bodyError('reserved_webhook_header', `Header "${h.key}" is reserved`, [
        'customHeaders',
        index,
        'key',
      ])
    }
  })
}

export function checkBrevoAuth(format: PayloadFormat, auth: BrevoAuth | undefined): void {
  if (auth && auth.type !== 'none' && format !== 'brevo') {
    throw bodyError('brevo_auth_requires_brevo', 'brevoAuth only applies to the brevo format', [
      'brevoAuth',
    ])
  }
}

/**
 * Basic auth written in the URL (Brevo accepts `https://user:pass@host/…`, D278): the URL is
 * stored without it and the credentials become `brevoAuth` basic. Only the brevo format
 * takes them, and not next to an explicit bearer or basic `brevoAuth`.
 */
export function urlAuth(
  format: PayloadFormat,
  rawUrl: string,
  auth: BrevoAuth | undefined,
): { url: string; brevoAuth: BrevoAuth | undefined } {
  const { url, basic } = splitUrlCredentials(rawUrl)
  if (!basic) return { url, brevoAuth: auth }
  if (format !== 'brevo') {
    throw bodyError(
      'url_credentials_require_brevo',
      'Credentials in the URL only apply to the brevo format',
      ['url'],
    )
  }
  if (auth && auth.type !== 'none') {
    throw bodyError(
      'conflicting_webhook_auth',
      'Give the credentials either in the URL or in brevoAuth, not both',
      ['url'],
    )
  }
  return { url, brevoAuth: { type: 'basic', ...basic } }
}

/** Stored form of Brevo auth: the type and, in `secret`, the token or "user:password". */
export function brevoSecret(auth: BrevoAuth | undefined): {
  brevoAuth: BrevoAuth['type']
  secret: string | null
} {
  if (!auth || auth.type === 'none') return { brevoAuth: 'none', secret: null }
  if (auth.type === 'bearer') return { brevoAuth: 'bearer', secret: auth.token }
  return { brevoAuth: 'basic', secret: `${auth.username}:${auth.password}` }
}

/** `MAILSINK_WEBHOOK_BLOCK_PRIVATE` (D150): a refused URL is a 422 on `url`. */
export async function checkEndpointUrl(guard: UrlGuard | undefined, url: string): Promise<void> {
  const refused = await guard?.(url)
  if (refused) {
    throw bodyError(
      'private_webhook_url',
      'Webhook URL resolves to a private, loopback or link-local address',
      ['url'],
    )
  }
}
