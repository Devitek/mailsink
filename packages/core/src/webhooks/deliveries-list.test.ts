import { ListWebhookDeliveriesQuery, WebhookEndpointInput } from '@mailsink/contracts'
import { insertWebhookDeliveries, newId } from '@mailsink/db'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { beforeAll, expect, it } from 'vitest'
import { listWebhookDeliveryViews } from './deliveries'
import { createWebhookEndpoint } from './endpoints'

describeDb('delivery log listing', (ctx) => {
  let ws = ''
  const ids: string[] = []
  const query = (input: Record<string, unknown>) => ListWebhookDeliveriesQuery.parse(input)

  beforeAll(async () => {
    ws = (await createTestWorkspace(ctx.db)).id
    const endpoint = await createWebhookEndpoint(
      ctx.db,
      ws,
      WebhookEndpointInput.parse({
        connectionId: null,
        url: 'https://hooks.example.test/a',
        events: ['email.delivered'],
      }),
    )
    for (let i = 0; i < 5; i++) {
      const id = newId('whd', Date.parse('2026-11-23T10:00:00Z') + i)
      ids.unshift(id)
      await insertWebhookDeliveries(ctx.db, [
        {
          id,
          workspaceId: ws,
          endpointId: endpoint.id,
          payloadFormat: 'unified',
          canonicalEvent: 'email.delivered',
          dialectEvent: 'email.delivered',
          body: '{}',
          status: i === 0 ? 'failed' : 'succeeded',
        },
      ])
    }
  })

  it('answers the total of the filter with every page', async () => {
    const first = await listWebhookDeliveryViews(ctx.db, ws, query({ limit: 2 }))
    expect(first.total).toBe(5)
    expect(first.data.map((d) => d.id)).toEqual(ids.slice(0, 2))
    const failed = await listWebhookDeliveryViews(ctx.db, ws, query({ status: 'failed' }))
    expect(failed.total).toBe(1)
  })

  it('pages by number when `page` is given, the cursor ignored', async () => {
    const third = await listWebhookDeliveryViews(
      ctx.db,
      ws,
      query({ limit: 2, page: 3, cursor: ids[0] }),
    )
    expect(third.data.map((d) => d.id)).toEqual(ids.slice(4))
    expect(third).toMatchObject({ total: 5, nextCursor: null })
    const second = await listWebhookDeliveryViews(ctx.db, ws, query({ limit: 2, page: 2 }))
    expect(second.data.map((d) => d.id)).toEqual(ids.slice(2, 4))
    expect(second.nextCursor).toBe(ids[3])
  })
})
