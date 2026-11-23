// What an `api_logs` row may keep of a call (#35): no credential, no attachment content,
// bounded bodies. Pure functions, unit tested in sanitize.test.ts.

/** Largest JSON text kept per body; beyond it the row keeps a preview of that length. */
export const LOG_BODY_MAX_CHARS = 32_768

const SECRET_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'api-key',
  'x-api-key',
  'cookie',
  'set-cookie',
])
const KEY_PREFIX = /^(mskw_|msk_|whsec_)/
const REDACTED = '[redacted]'

/** Keeps the scheme and the Mailsink key prefix (`Bearer msk_[redacted]`), never the secret. */
function redactCredential(value: string): string {
  const [first = '', second] = value.trim().split(/\s+/, 2)
  const scheme = second === undefined ? '' : `${first} `
  const token = second ?? first
  return `${scheme}${KEY_PREFIX.exec(token)?.[1] ?? ''}${REDACTED}`
}

/** Request headers as a plain record, credentials and cookies redacted. */
export function redactHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, name) => {
    const key = name.toLowerCase()
    if (!SECRET_HEADERS.has(key)) out[key] = value
    else out[key] = key.includes('cookie') ? REDACTED : redactCredential(value)
  })
  return out
}

const ATTACHMENT_KEYS = new Set(['attachments', 'attachment'])
const MAX_DEPTH = 12

function stripAttachment(item: unknown): unknown {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item
  const copy: Record<string, unknown> = { ...(item as Record<string, unknown>) }
  if (typeof copy.content === 'string') copy.content = `[omitted: ${copy.content.length} chars]`
  return copy
}

/**
 * Replaces the `content` of every attachment (native and Resend `attachments`, Brevo
 * `attachment`) with its size, at any depth (batches).
 */
export function stripAttachments(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH || !value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v) => stripAttachments(v, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(value)) {
    out[key] =
      ATTACHMENT_KEYS.has(key) && Array.isArray(v)
        ? v.map(stripAttachment)
        : stripAttachments(v, depth + 1)
  }
  return out
}

const SECRET_KEY = /password|secret|token|apikey|api_key|workspacekey/i
const SECRET_IN_TEXT = /\b(mskw_|msk_|whsec_)[A-Za-z0-9_+/=-]{8,}/g

/**
 * Secrets never land in a log body: values under a secret-looking key (`password`,
 * `apiKey`, `workspaceKey`, `secret`, `token`…) and any Mailsink key or webhook secret
 * inside a string (Admin creation responses, credential snippets) keep only their prefix.
 */
export function redactSecrets(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return value.replace(SECRET_IN_TEXT, `$1${REDACTED}`)
  if (depth > MAX_DEPTH || !value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(value)) {
    out[key] =
      SECRET_KEY.test(key) && typeof v === 'string'
        ? `${KEY_PREFIX.exec(v)?.[1] ?? ''}${REDACTED}`
        : redactSecrets(v, depth + 1)
  }
  return out
}

export type TruncatedBody = { truncated: true; size: number; preview: string }

/** The value itself when its JSON fits, else a preview of the JSON text. */
export function boundBody(value: unknown, max = LOG_BODY_MAX_CHARS): unknown {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (text === undefined) return null
  if (text.length <= max) return value
  return { truncated: true, size: text.length, preview: text.slice(0, max) } as TruncatedBody
}

/**
 * A request or response body as stored: parsed JSON when it is, else the raw text;
 * attachments stripped, secrets redacted, bounded.
 */
export function logBody(text: string | null | undefined, max = LOG_BODY_MAX_CHARS): unknown {
  if (!text) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return boundBody(redactSecrets(text), max)
  }
  return boundBody(redactSecrets(stripAttachments(parsed)), max)
}

const MESSAGE_ID = /^msg_[A-Za-z0-9-]{1,64}$/
const MESSAGE_ID_IN_TEXT = /msg_[A-Za-z0-9-]{1,64}/

/**
 * Message ids a response names, whatever the dialect: `id` (native, Resend), `data[].id`
 * (batches), Brevo `messageId` (`<msg_…@host>`). Deduplicated, in order.
 */
export function messageIdsOf(body: unknown): string[] {
  const found = new Set<string>()
  const visit = (value: unknown, depth: number) => {
    if (depth > 4 || !value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      for (const v of value) {
        if (typeof v === 'string' && MESSAGE_ID.test(v)) found.add(v)
        else visit(v, depth + 1)
      }
      return
    }
    for (const [key, v] of Object.entries(value)) {
      if (typeof v === 'string' && (key === 'id' || key === 'messageId')) {
        const id = MESSAGE_ID.test(v) ? v : MESSAGE_ID_IN_TEXT.exec(v)?.[0]
        if (id && (key === 'messageId' || id === v)) found.add(id)
      } else if (key === 'data' || key === 'messageIds' || Array.isArray(v)) {
        visit(v, depth + 1)
      }
    }
  }
  visit(body, 0)
  return [...found]
}
