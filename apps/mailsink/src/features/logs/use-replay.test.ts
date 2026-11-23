import type { WebhookDeliveryView } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import { placeholderReplay, withReplay } from './use-replay'

const source: WebhookDeliveryView = {
  id: 'whd_2',
  endpointId: 'whe_1',
  messageId: 'msg_1',
  eventId: 'evt_1',
  payloadFormat: 'resend',
  canonicalEvent: 'email.delivered',
  dialectEvent: 'email.delivered',
  recipient: null,
  status: 'failed',
  attemptCount: 8,
  nextAttemptAt: null,
  lastStatusCode: 500,
  replayOf: 'whd_1',
  replayMode: 'exact',
  endpointUrl: 'https://hooks.example.test/mailsink',
  durationMs: 42,
  createdAt: '2026-11-22T10:00:00.000Z',
}

describe('optimistic replay', () => {
  it('builds the pending replay of the first delivery of the chain', () => {
    const row = placeholderReplay(source, 'resign', Date.UTC(2026, 10, 23))
    expect(row).toMatchObject({
      id: `whd_pending-${Date.UTC(2026, 10, 23)}`,
      status: 'pending',
      attemptCount: 0,
      lastStatusCode: null,
      replayOf: 'whd_1',
      replayMode: 'resign',
      createdAt: '2026-11-23T00:00:00.000Z',
    })
  })

  it('prepends it to first pages whose filters it matches', () => {
    const page = { data: [source], nextCursor: null }
    const row = placeholderReplay(source, 'exact')
    expect(withReplay(page, { limit: 50 }, row)?.data.map((d) => d.id)).toEqual([row.id, 'whd_2'])
    expect(withReplay(page, { cursor: 'whd_9' }, row)).toBe(page)
    expect(withReplay(page, { status: 'failed' }, row)).toBe(page)
    expect(withReplay(page, { payloadFormat: 'brevo' }, row)).toBe(page)
    expect(withReplay(page, { status: 'pending', endpointId: 'whe_1' }, row)?.data).toHaveLength(2)
  })
})
