import type { ListWebhookDeliveriesResponse, WebhookDeliveryView } from '@mailsink/contracts'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { applyLogEvent } from './apply-log-event'

const delivery: WebhookDeliveryView = {
  id: 'whd_1',
  endpointId: 'whe_1',
  messageId: 'msg_1',
  eventId: 'evt_1',
  payloadFormat: 'resend',
  canonicalEvent: 'email.delivered',
  dialectEvent: 'email.delivered',
  recipient: 'julie@gmail.test',
  status: 'retrying',
  attemptCount: 1,
  nextAttemptAt: null,
  lastStatusCode: 500,
  replayOf: null,
  replayMode: null,
  createdAt: '2026-11-22T10:00:00.000Z',
}
const listKey = ['logs', 'staging', 'webhooks', 'list', { limit: 50 }]

describe('logs stream cache', () => {
  it('writes a delivery frame in place and refetches the webhook views', () => {
    const qc = new QueryClient()
    qc.setQueryData<ListWebhookDeliveriesResponse>(listKey, {
      data: [delivery, { ...delivery, id: 'whd_2' }],
      nextCursor: null,
    })
    const done = { ...delivery, status: 'succeeded' as const, lastStatusCode: 200 }
    const keys = applyLogEvent(qc, 'staging', { type: 'webhook.delivery', delivery: done })
    const page = qc.getQueryData<ListWebhookDeliveriesResponse>(listKey)
    expect(page?.data.map((d) => d.status)).toEqual(['succeeded', 'retrying'])
    expect(keys).toEqual([
      ['logs', 'staging', 'webhooks', 'list'],
      ['logs', 'staging', 'sources'],
      ['logs', 'staging', 'webhooks', 'detail', 'whd_1'],
    ])
  })

  it('refetches the API and SMTP lists and the tab counts on new rows', () => {
    const qc = new QueryClient()
    const api = applyLogEvent(qc, 'staging', {
      type: 'log.api',
      log: {
        id: 'req_1',
        connectionId: null,
        dialect: 'native',
        method: 'POST',
        path: '/v1/emails',
        statusCode: 200,
        durationMs: 3,
        errorCode: null,
        messageIds: [],
        createdAt: '2026-11-22T10:00:00.000Z',
      },
    })
    expect(api).toEqual([
      ['logs', 'staging', 'api', 'list'],
      ['logs', 'staging', 'sources'],
    ])
    expect(applyLogEvent(qc, 'staging', { type: 'messages.purged', count: 2 })).toEqual([
      ['logs', 'staging'],
    ])
    expect(
      applyLogEvent(qc, 'staging', { type: 'workspace.deleted', workspaceId: 'ws_1' }),
    ).toEqual([])
  })
})
