import { CanonicalEvent, type EventType, type PayloadFormat } from '@mailsink/contracts'

// Canonical <-> dialect event names (03-contracts, « Event mapping », D22). Stored form is
// always canonical; dialect names only live at the edges (API, UI, emitted payload).

type Row = { resend: string | null; brevo: string | null; brevoSubscription: string | null }

const MAP: Record<CanonicalEvent, Row> = {
  'email.sent': { resend: 'email.sent', brevo: 'request', brevoSubscription: 'request' },
  'email.delivered': {
    resend: 'email.delivered',
    brevo: 'delivered',
    brevoSubscription: 'delivered',
  },
  'email.deferred': {
    resend: 'email.delivery_delayed',
    brevo: 'deferred',
    brevoSubscription: 'deferred',
  },
  'email.soft_bounced': {
    resend: 'email.delivery_delayed',
    brevo: 'soft_bounce',
    brevoSubscription: 'softBounce',
  },
  'email.hard_bounced': {
    resend: 'email.bounced',
    brevo: 'hard_bounce',
    brevoSubscription: 'hardBounce',
  },
  'email.complained': { resend: 'email.complained', brevo: 'spam', brevoSubscription: 'spam' },
  'email.opened': { resend: 'email.opened', brevo: 'opened', brevoSubscription: 'opened' },
  'email.clicked': { resend: 'email.clicked', brevo: 'click', brevoSubscription: 'click' },
  'email.suppressed': { resend: null, brevo: 'blocked', brevoSubscription: 'blocked' },
  'email.failed': { resend: 'email.failed', brevo: null, brevoSubscription: null },
}

const CANONICAL = CanonicalEvent.options

/** Brevo names accepted on top of the subscription names (alias `sent`, payload names). */
const BREVO_ALIASES: Record<string, CanonicalEvent> = {
  sent: 'email.sent',
  soft_bounce: 'email.soft_bounced',
  hard_bounce: 'email.hard_bounced',
}

/** Emitted name of `canonical` in `format`, or null when the format has no equivalent. */
export function toDialect(format: PayloadFormat, canonical: CanonicalEvent): string | null {
  return format === 'unified' ? canonical : MAP[canonical][format]
}

/** Name shown and accepted for a subscription (Brevo subscription names differ). */
export function subscriptionName(format: PayloadFormat, canonical: CanonicalEvent): string | null {
  return format === 'brevo' ? MAP[canonical].brevoSubscription : toDialect(format, canonical)
}

/**
 * Canonical events a subscription name stands for (many-to-one on purpose: Resend
 * `email.delivery_delayed` is deferred + soft bounced). Canonical names are always
 * accepted; an unknown name gives an empty list.
 */
export function toCanonical(format: PayloadFormat, name: string): CanonicalEvent[] {
  if ((CANONICAL as readonly string[]).includes(name)) return [name as CanonicalEvent]
  if (format === 'unified') return []
  if (format === 'brevo' && BREVO_ALIASES[name]) return [BREVO_ALIASES[name]]
  return CANONICAL.filter((c) => subscriptionName(format, c) === name)
}

/** Deduplicated canonical events, in the order of the contract enum. */
export function sortCanonical(events: Iterable<CanonicalEvent>): CanonicalEvent[] {
  const set = new Set(events)
  return CANONICAL.filter((c) => set.has(c))
}

/** Subscription names of the stored events in `format`, deduplicated (view `events`). */
export function dialectNames(format: PayloadFormat, events: readonly CanonicalEvent[]): string[] {
  const names = sortCanonical(events).map((c) => subscriptionName(format, c))
  return [...new Set(names.filter((n): n is string => n !== null))]
}

/** Stored events `format` cannot emit (kept, never sent, D22). */
export function unsupportedEvents(
  format: PayloadFormat,
  events: readonly CanonicalEvent[],
): CanonicalEvent[] {
  return sortCanonical(events).filter((c) => toDialect(format, c) === null)
}

const FROM_EVENT_TYPE: Partial<Record<EventType, CanonicalEvent>> = {
  sent: 'email.sent',
  delivered: 'email.delivered',
  deferred: 'email.deferred',
  soft_bounce: 'email.soft_bounced',
  hard_bounce: 'email.hard_bounced',
  complained: 'email.complained',
  failed: 'email.failed',
  suppressed: 'email.suppressed',
  opened: 'email.opened',
  clicked: 'email.clicked',
}

/** Canonical webhook event of a `message_events` type (`accepted` has none). */
export function canonicalOfEventType(type: EventType): CanonicalEvent | null {
  return FROM_EVENT_TYPE[type] ?? null
}
