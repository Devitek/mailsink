import { describe, expect, it } from 'vitest'
import {
  canonicalOfEventType,
  dialectNames,
  toCanonical,
  toDialect,
  unsupportedEvents,
} from './events-map'

describe('webhook event mapping', () => {
  it('emits the dialect names of the 03-contracts table', () => {
    expect(toDialect('resend', 'email.soft_bounced')).toBe('email.delivery_delayed')
    expect(toDialect('resend', 'email.hard_bounced')).toBe('email.bounced')
    expect(toDialect('resend', 'email.suppressed')).toBeNull()
    expect(toDialect('brevo', 'email.hard_bounced')).toBe('hard_bounce')
    expect(toDialect('brevo', 'email.complained')).toBe('spam')
    expect(toDialect('brevo', 'email.failed')).toBeNull()
    expect(toDialect('unified', 'email.failed')).toBe('email.failed')
  })

  it('expands dialect subscription names to canonical events (many-to-one)', () => {
    expect(toCanonical('resend', 'email.delivery_delayed')).toEqual([
      'email.deferred',
      'email.soft_bounced',
    ])
    expect(toCanonical('brevo', 'hardBounce')).toEqual(['email.hard_bounced'])
    expect(toCanonical('brevo', 'hard_bounce')).toEqual(['email.hard_bounced'])
    expect(toCanonical('brevo', 'sent')).toEqual(['email.sent'])
    expect(toCanonical('brevo', 'request')).toEqual(['email.sent'])
    expect(toCanonical('brevo', 'email.failed')).toEqual(['email.failed'])
    expect(toCanonical('unified', 'email.bounced')).toEqual([])
    expect(toCanonical('resend', 'nope')).toEqual([])
  })

  it('reports names and unsupported events of a stored subscription', () => {
    const stored = ['email.failed', 'email.deferred', 'email.soft_bounced', 'email.sent'] as const
    expect(dialectNames('resend', stored)).toEqual([
      'email.sent',
      'email.delivery_delayed',
      'email.failed',
    ])
    expect(dialectNames('brevo', stored)).toEqual(['request', 'deferred', 'softBounce'])
    expect(unsupportedEvents('brevo', stored)).toEqual(['email.failed'])
    expect(unsupportedEvents('unified', stored)).toEqual([])
  })

  it('maps message event types to canonical events', () => {
    expect(canonicalOfEventType('hard_bounce')).toBe('email.hard_bounced')
    expect(canonicalOfEventType('clicked')).toBe('email.clicked')
    expect(canonicalOfEventType('accepted')).toBeNull()
  })
})
