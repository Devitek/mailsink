import type {
  DeliveryStatus,
  SmtpOutcome,
  SmtpSessionSummary,
  WebhookDeliveryStatus,
} from '@mailsink/contracts'

// Display helpers of the logs explorer (#41): status tones on the status colours (the
// prototype's `httpK`), log timestamps, durations.

/** Prototype tones: 5xx red, 4xx amber, the rest green. */
export function httpTone(code: number | null): DeliveryStatus {
  if (code === null) return 'queued'
  if (code >= 500) return 'hard_bounce'
  if (code >= 400) return 'soft_bounce'
  return 'delivered'
}

export const SMTP_TONE: Record<SmtpOutcome, DeliveryStatus> = {
  accepted: 'delivered',
  rejected: 'soft_bounce',
  auth_failed: 'hard_bounce',
  error: 'failed',
}

export const DELIVERY_TONE: Record<WebhookDeliveryStatus, DeliveryStatus> = {
  pending: 'queued',
  retrying: 'soft_bounce',
  succeeded: 'delivered',
  failed: 'hard_bounce',
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/** `14:33:51.204` today, `22 Nov 14:33:51.204` before (local time). */
export function formatLogTime(iso: string, locale: string, now = Date.now()): string {
  const date = new Date(iso)
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hourCycle: 'h23',
  }).format(date)
  if (sameDay(date, new Date(now))) return time
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date)
  return `${day} ${time}`
}

/** Full local date and time, for titles and the inspector header. */
export function formatLogDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(
    new Date(iso),
  )
}

/** Duration of an SMTP session, null while it is open. */
export function sessionDurationMs(
  session: Pick<SmtpSessionSummary, 'startedAt' | 'endedAt'>,
): number | null {
  if (!session.endedAt) return null
  return Math.max(0, Date.parse(session.endedAt) - Date.parse(session.startedAt))
}

/** Prototype: durations above one second are highlighted. */
export const SLOW_MS = 1000

/** `1-50 of 312` (no total for keyset pages: `1-50`). */
export function rangeOf(page: number, pageSize: number, rows: number, total?: number): string {
  if (rows === 0) return total === undefined ? '0' : `0 / ${total}`
  const first = (page - 1) * pageSize + 1
  const range = `${first}-${first + rows - 1}`
  return total === undefined ? range : `${range} / ${total}`
}
