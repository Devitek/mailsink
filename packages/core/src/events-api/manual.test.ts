import { TriggerEventRequest, WebhookEndpointInput } from '@mailsink/contracts'
import {
  type Job,
  listMessageEvents,
  messageRecipients,
  messages,
  suppressions,
  webhookDeliveries,
  workspaces,
} from '@mailsink/db'
import {
  createTestConnection,
  createTestMessage,
  createTestRecipients,
  createTestWorkspace,
  describeDb,
} from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { beforeEach, expect, it } from 'vitest'
import { simulateDeliveryHandler } from '../jobs/handlers/simulate'
import { baselinePlanner } from '../simulation/planner'
import { createWebhookEndpoint } from '../webhooks/endpoints'
import { triggerMessageEvent } from './manual'

describeDb('manual message events', (ctx) => {
  let ws = ''
  let con = ''
  const trigger = (messageId: string, body: unknown) =>
    triggerMessageEvent(ctx.db, ws, messageId, TriggerEventRequest.parse(body))

  beforeEach(async () => {
    ws = (await createTestWorkspace(ctx.db)).id
    con = (await createTestConnection(ctx.db, ws)).id
    await createWebhookEndpoint(
      ctx.db,
      ws,
      WebhookEndpointInput.parse({
        connectionId: null,
        url: 'http://127.0.0.1:9/hook',
        events: ['email.opened', 'email.clicked', 'email.hard_bounced', 'email.invalid'],
      }),
    )
  })

  async function message(statuses: ('delivered' | 'suppressed')[] = ['delivered', 'delivered']) {
    const msg = await createTestMessage(ctx.db, ws, { connectionId: con, status: 'delivered' })
    await createTestRecipients(
      ctx.db,
      msg,
      statuses.map((status, i) => ({ email: `r${i}@x.io`, status })),
    )
    return msg
  }

  it('records opened and clicked per recipient and fans them out', async () => {
    const msg = await message()
    const opened = await trigger(msg.id, { type: 'opened', userAgent: 'UA' })
    expect(opened.events.map((e) => [e.recipientEmail, e.type, e.origin])).toEqual([
      ['r0@x.io', 'opened', 'api'],
      ['r1@x.io', 'opened', 'api'],
    ])
    expect(opened.deliveries).toHaveLength(2)
    const clicked = await trigger(msg.id, {
      type: 'clicked',
      url: 'https://x.io/a',
      recipient: 'R1@x.io',
    })
    expect(clicked.events[0]?.data).toEqual({ url: 'https://x.io/a' })
    const [delivery] = await ctx.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.eventId, clicked.events[0]?.id ?? ''))
    expect(JSON.parse(delivery?.body ?? '{}')).toMatchObject({
      event: 'email.clicked',
      recipient: 'r1@x.io',
      detail: { url: 'https://x.io/a' },
    })
  })

  it('forces a status: recipient, aggregate, suppression list and webhooks', async () => {
    const msg = await message()
    const result = await trigger(msg.id, {
      type: 'status',
      status: 'hard_bounce',
      recipient: 'r0@x.io',
      reason: 'forced',
    })
    expect(result.messageStatus).toBe('hard_bounce')
    expect(result.deliveries).toHaveLength(1)
    const rows = await ctx.db
      .select()
      .from(messageRecipients)
      .where(eq(messageRecipients.messageId, msg.id))
    expect(rows.map((r) => [r.email, r.status, r.statusReason]).sort()).toEqual([
      ['r0@x.io', 'hard_bounce', 'forced'],
      ['r1@x.io', 'delivered', null],
    ])
    const [m] = await ctx.db.select().from(messages).where(eq(messages.id, msg.id))
    expect(m?.status).toBe('hard_bounce')
    const listed = await ctx.db.select().from(suppressions).where(eq(suppressions.workspaceId, ws))
    expect(listed).toMatchObject([{ email: 'r0@x.io', reason: 'hard_bounce', messageId: msg.id }])
    expect((await listMessageEvents(ctx.db, msg.id)).at(-1)).toMatchObject({
      type: 'hard_bounce',
      data: { reason: 'forced' },
    })
  })

  it('forces an invalid address: email.invalid, never the suppression list (D283)', async () => {
    const msg = await message()
    const result = await trigger(msg.id, {
      type: 'status',
      status: 'invalid',
      recipient: 'r1@x.io',
    })
    expect(result.events).toMatchObject([{ type: 'invalid', recipientEmail: 'r1@x.io' }])
    expect(result.deliveries).toHaveLength(1)
    const [delivery] = await ctx.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.workspaceId, ws))
    expect(delivery?.canonicalEvent).toBe('email.invalid')
    expect(result.messageStatus).toBe('invalid')
    const listed = await ctx.db.select().from(suppressions).where(eq(suppressions.workspaceId, ws))
    expect(listed).toEqual([])
  })

  it('answers 404 for unknown messages or recipients and 409 for suppressed ones', async () => {
    const msg = await message(['delivered', 'suppressed'])
    await expect(trigger(msg.id, { type: 'opened', recipient: 'no@x.io' })).rejects.toMatchObject({
      code: 'not_found',
    })
    await expect(trigger(msg.id, { type: 'opened', recipient: 'r1@x.io' })).rejects.toMatchObject({
      code: 'conflict',
    })
    const other = await createTestWorkspace(ctx.db)
    await expect(
      triggerMessageEvent(ctx.db, other.id, msg.id, { type: 'opened' }),
    ).rejects.toMatchObject({ code: 'not_found' })
    expect((await trigger(msg.id, { type: 'opened' })).events).toHaveLength(1)
  })

  it('draws automatic opened and clicked events from openRate and clickRate', async () => {
    const [row] = await ctx.db.select().from(workspaces).where(eq(workspaces.id, ws))
    await ctx.db
      .update(workspaces)
      .set({ simulation: { ...(row?.simulation ?? {}), openRate: 100, clickRate: 100 } as never })
      .where(eq(workspaces.id, ws))
    const msg = await createTestMessage(ctx.db, ws, {
      connectionId: con,
      links: [{ url: 'https://x.io/l' }],
    })
    await createTestRecipients(ctx.db, msg, [{ email: 'a@x.io' }])
    const handler = simulateDeliveryHandler({ planner: baselinePlanner })
    await handler({ workspaceId: ws, payload: { messageId: msg.id } } as Job, {
      db: ctx.db,
      signal: new AbortController().signal,
    })
    const events = await listMessageEvents(ctx.db, msg.id)
    expect(events.map((e) => [e.type, e.origin])).toEqual([
      ['sent', 'simulation'],
      ['delivered', 'simulation'],
      ['opened', 'simulation'],
      ['clicked', 'simulation'],
    ])
    expect(events.at(-1)?.data).toMatchObject({ url: 'https://x.io/l' })
    const fanned = await ctx.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.messageId, msg.id))
    expect(fanned.map((d) => d.canonicalEvent).sort()).toEqual(['email.clicked', 'email.opened'])
  })
})
