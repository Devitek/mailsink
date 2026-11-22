import { describe, expect, it } from 'vitest'
import { ListMessagesQuery, MessageSummary, PurgeQuery, TriggerEventRequest } from './capture'

describe('ListMessagesQuery', () => {
  it('applies defaults', () => {
    expect(ListMessagesQuery.parse({})).toEqual({ limit: 50, wait: false, timeout: 5_000 })
  })

  it('coerces query strings', () => {
    const parsed = ListMessagesQuery.parse({ limit: '20', wait: 'true', timeout: '1000' })
    expect(parsed).toMatchObject({ limit: 20, wait: true, timeout: 1_000 })
  })

  it.each([
    ['delivered', ['delivered']],
    ['delivered,hard_bounce', ['delivered', 'hard_bounce']],
    [
      ['failed', 'queued'],
      ['failed', 'queued'],
    ],
  ])('normalizes status %j', (status, expected) => {
    expect(ListMessagesQuery.parse({ status }).status).toEqual(expected)
  })

  it('rejects an unknown status', () => {
    expect(ListMessagesQuery.safeParse({ status: 'lost' }).success).toBe(false)
  })

  it.each([
    ['0', true],
    ['30000', true],
    ['-1', false],
    ['30001', false],
    ['1.5', false],
  ])('bounds timeout %s', (timeout, ok) => {
    expect(ListMessagesQuery.safeParse({ timeout }).success).toBe(ok)
  })

  it.each([
    ['0', false],
    ['200', true],
    ['201', false],
  ])('bounds limit %s', (limit, ok) => {
    expect(ListMessagesQuery.safeParse({ limit }).success).toBe(ok)
  })

  it('validates dates and their order', () => {
    const since = '2026-11-22T10:00:00Z'
    expect(ListMessagesQuery.safeParse({ since, until: '2026-11-22T11:00:00+01:00' }).success).toBe(
      true,
    )
    const result = ListMessagesQuery.safeParse({ since, until: '2026-11-22T09:00:00Z' })
    expect(result.error?.issues[0]).toMatchObject({ params: { code: 'since_after_until' } })
    expect(ListMessagesQuery.safeParse({ since: 'yesterday' }).success).toBe(false)
  })

  it('checks the connection id prefix', () => {
    expect(ListMessagesQuery.safeParse({ connectionId: 'ws_1' }).success).toBe(false)
  })
})

describe('MessageSummary', () => {
  it('parses a server row', () => {
    const summary = {
      id: 'msg_01',
      connectionId: null,
      source: 'native',
      from: { email: 'app@x.io', name: null },
      to: [{ email: 'jane@x.io', name: 'Jane' }],
      subject: 'Hi',
      status: 'delivered',
      tags: [{ name: 'flow', value: 'signup' }],
      hasAttachments: false,
      createdAt: '2026-11-22T10:00:00.000Z',
    }
    expect(MessageSummary.safeParse(summary).success).toBe(true)
  })
})

describe('TriggerEventRequest and PurgeQuery', () => {
  it('requires a url for clicked', () => {
    expect(TriggerEventRequest.safeParse({ type: 'clicked' }).success).toBe(false)
    expect(TriggerEventRequest.safeParse({ type: 'opened' }).success).toBe(true)
  })
  it('defaults includeLogs to true', () => {
    expect(PurgeQuery.parse({})).toEqual({ includeLogs: true })
    expect(PurgeQuery.parse({ includeLogs: 'false' })).toEqual({ includeLogs: false })
  })
})
