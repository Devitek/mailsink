import { createEventBus, type EventBus } from '@mailsink/core'
import { insertCapturedMessage } from '@mailsink/core/capture-testing'
import { createTestWorkspaceWithConnection, describeDb } from '@mailsink/db/testing'
import type { Client } from '@modelcontextprotocol/client'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { McpContext } from './context'
import { connectClient, toolJson } from './testing'

const PUBLIC_URL = 'https://mail.example.com'

describeDb('MCP tools', (db) => {
  let bus: EventBus
  let ctx: McpContext
  let other: McpContext
  let client: Client
  let connectionId: string
  beforeAll(async () => {
    bus = createEventBus()
    const a = await createTestWorkspaceWithConnection(db.db, { workspace: { name: 'A' } })
    const b = await createTestWorkspaceWithConnection(db.db, { workspace: { name: 'B' } })
    connectionId = a.connection.id
    ctx = { db: db.db, bus, workspace: a.workspace, publicUrl: PUBLIC_URL }
    other = { db: db.db, bus, workspace: b.workspace, publicUrl: PUBLIC_URL }
    client = await connectClient(ctx)
  })
  afterAll(() => client.close())

  const call = async (name: string, args: Record<string, unknown> = {}) =>
    toolJson(await client.callTool({ name, arguments: args }))

  it('lists every tool with an object input schema', async () => {
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([
      'get_delivery_logs',
      'get_email',
      'get_email_attachment',
      'get_email_source',
      'get_override_config',
      'get_webhook_deliveries',
      'list_emails',
      'list_suppressions',
      'purge_emails',
      'reset_override_config',
      'set_override_config',
      'trigger_email_event',
      'wait_for_email',
    ])
    for (const tool of tools) expect(tool.inputSchema.type).toBe('object')
  })

  it('lists, filters and reads the emails of its workspace only', async () => {
    const { id } = await insertCapturedMessage(db.db, ctx.workspace.id, {
      subject: 'Reset your password',
      to: ['jane@example.com'],
    })
    const foreign = await insertCapturedMessage(db.db, other.workspace.id, { subject: 'Other' })

    const list = await call('list_emails', { to: 'jane@', subject: 'password' })
    expect(list.isError).toBe(false)
    expect(list.json.data.map((m: { id: string }) => m.id)).toEqual([id])

    const detail = await call('get_email', { id })
    expect(detail.json).toMatchObject({ id, subject: 'Reset your password', text: 'Hello' })

    const missing = await call('get_email', { id: foreign.id })
    expect(missing).toMatchObject({ isError: true, json: { error: { code: 'not_found' } } })
  })

  it('validates the arguments like the HTTP API', async () => {
    const res = await call('list_emails', {
      since: '2026-02-01T00:00:00Z',
      until: '2026-01-01T00:00:00Z',
    })
    expect(res.isError).toBe(true)
    expect(res.json.error).toMatchObject({
      code: 'validation_error',
      details: { in: 'arguments', issues: [{ params: { code: 'since_after_until' } }] },
    })
    const bad = await client.callTool({ name: 'get_email', arguments: { id: 'nope' } })
    expect(bad.isError).toBe(true)
  })

  it('waits for the next email and times out without one', async () => {
    const pending = call('wait_for_email', { subject: 'Welcome aboard' })
    await new Promise((r) => setTimeout(r, 50))
    const { id } = await insertCapturedMessage(db.db, ctx.workspace.id, {
      subject: 'Welcome aboard',
    })
    bus.publish(ctx.workspace.id, {
      id: null,
      connectionId: null,
      event: { type: 'messages.purged', count: 0 },
    })
    const res = await pending
    expect(res.json.data.map((m: { id: string }) => m.id)).toEqual([id])

    const timeout = await call('wait_for_email', { subject: 'never', timeout: 0 })
    expect(timeout).toMatchObject({ isError: true, json: { error: { code: 'wait_timeout' } } })
  })

  it('triggers an event with origin mcp and publishes it', async () => {
    const { id } = await insertCapturedMessage(db.db, ctx.workspace.id, { status: 'delivered' })
    const frames: string[] = []
    const off = bus.subscribe(ctx.workspace.id, (f) => frames.push(f.event.type))
    const res = await call('trigger_email_event', { id, event: { type: 'opened' } })
    off()
    expect(res.isError).toBe(false)
    expect(res.json.events).toMatchObject([{ type: 'opened', origin: 'mcp' }])
    expect(frames).toContain('message.event')
  })

  it('sets, reads and resets an override activated via mcp', async () => {
    const set = await call('set_override_config', {
      connectionId,
      config: { rates: { hard_bounce: 100 } },
      ttl: '10m',
    })
    expect(set.json.connections).toMatchObject([{ connectionId, activatedVia: 'mcp' }])
    const read = await call('get_override_config')
    expect(read.json.effective[connectionId].rates).toEqual({ hard_bounce: 100 })
    const reset = await call('reset_override_config', { connectionId })
    expect(reset.json.connections).toEqual([])
    // Schema errors are answered by the SDK before the tool runs.
    const empty = await client.callTool({ name: 'set_override_config', arguments: { config: {} } })
    expect(empty.isError).toBe(true)
  })

  it('reads the delivery logs, webhook deliveries and suppressions', async () => {
    expect((await call('get_delivery_logs')).json).toMatchObject({ data: [], page: 1 })
    expect((await call('get_delivery_logs', { source: 'smtp' })).json).toMatchObject({
      data: [],
      total: 0,
    })
    const missing = await call('get_delivery_logs', { source: 'smtp', id: 'smtp_missing' })
    expect(missing.json.error.code).toBe('not_found')
    const invalid = await call('get_delivery_logs', { id: 'smtp_x' })
    expect(invalid.json.error.code).toBe('validation_error')
    expect((await call('get_webhook_deliveries')).json).toMatchObject({ data: [] })
    expect((await call('list_suppressions')).json).toMatchObject({ data: [] })
  })

  it('purges the emails and publishes the purge', async () => {
    await insertCapturedMessage(db.db, ctx.workspace.id)
    const frames: string[] = []
    const off = bus.subscribe(ctx.workspace.id, (f) => frames.push(f.event.type))
    const res = await call('purge_emails', {})
    off()
    expect(res.json.count).toBeGreaterThan(0)
    expect(frames).toEqual(['messages.purged'])
    expect((await call('list_emails')).json.data).toEqual([])
  })
})
