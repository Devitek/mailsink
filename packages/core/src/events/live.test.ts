import {
  ActivateOverrideRequest,
  PurgeQuery,
  TriggerEventRequest,
  WebhookEndpointInput,
} from '@mailsink/contracts'
import {
  createTestMessage,
  createTestRecipients,
  createTestWorkspaceWithConnection,
  describeDb,
} from '@mailsink/db/testing'
import { beforeEach, expect, it } from 'vitest'
import { purgeAndPublish } from '../capture/publish-purge'
import { triggerAndPublishEvent } from '../events-api/publish-trigger'
import { activateAndPublishOverride, resetAndPublishOverride } from '../overrides/publish'
import { createWebhookEndpoint } from '../webhooks/endpoints'
import { createEventBus, type EventBus, type StreamFrame } from './bus'

// The services shared by the Capture routes and the MCP tools publish their outcome (D6).
describeDb('state changes published on the bus', (ctx) => {
  let seeded: Awaited<ReturnType<typeof createTestWorkspaceWithConnection>>
  let bus: EventBus
  let seen: StreamFrame[]
  const deps = () => ({ db: ctx.db, bus })
  const types = () => seen.map((f) => f.event.type)

  beforeEach(async () => {
    seeded = await createTestWorkspaceWithConnection(ctx.db)
    bus = createEventBus()
    seen = []
    bus.subscribe(seeded.workspace.id, (f) => seen.push(f))
  })

  it('publishes a forced status: events, aggregate and webhook deliveries', async () => {
    const ws = seeded.workspace.id
    await createWebhookEndpoint(
      ctx.db,
      ws,
      WebhookEndpointInput.parse({
        connectionId: null,
        url: 'http://127.0.0.1:9/hook',
        events: ['email.hard_bounced'],
      }),
    )
    const msg = await createTestMessage(ctx.db, ws, {
      connectionId: seeded.connection.id,
      status: 'delivered',
    })
    await createTestRecipients(ctx.db, msg, [{ email: 'a@x.io', status: 'delivered' }])
    const request = TriggerEventRequest.parse({ type: 'status', status: 'hard_bounce' })
    const response = await triggerAndPublishEvent(deps(), ws, msg.id, request, 'mcp')
    expect(response.events).toHaveLength(1)
    expect(response.events[0]).toMatchObject({ type: 'hard_bounce', origin: 'mcp' })
    expect(response.webhookDeliveries).toHaveLength(1)
    expect(types()).toEqual(['message.event', 'message.status', 'webhook.delivery'])
  })

  it('publishes messages.purged with the scope of the purge', async () => {
    const ws = seeded.workspace.id
    await createTestMessage(ctx.db, ws, { connectionId: seeded.connection.id })
    const query = PurgeQuery.parse({ connectionId: seeded.connection.id })
    await expect(purgeAndPublish(deps(), ws, query)).resolves.toEqual({ count: 1 })
    expect(seen).toEqual([
      {
        id: null,
        connectionId: seeded.connection.id,
        event: { type: 'messages.purged', count: 1 },
      },
    ])
  })

  it('publishes override.changed on activation and on an idempotent reset', async () => {
    const request = ActivateOverrideRequest.parse({ config: { rates: { failed: 100 } } })
    const state = await activateAndPublishOverride(deps(), seeded.workspace, request, 'mcp')
    expect(state.workspace?.activatedVia).toBe('mcp')
    await resetAndPublishOverride(deps(), seeded.workspace, undefined)
    await resetAndPublishOverride(deps(), seeded.workspace, undefined)
    expect(types()).toEqual(['override.changed', 'override.changed', 'override.changed'])
    expect(seen.every((f) => f.connectionId === null)).toBe(true)
  })
})
