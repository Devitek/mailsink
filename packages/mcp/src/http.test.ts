import { createEventBus, type EventBus } from '@mailsink/core'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { beforeAll, expect, it } from 'vitest'
import type { McpContext } from './context'
import { DELETED_GRACE_MS, handleMcpRequest } from './http'
import { connectClient, toolJson } from './testing'

const post = (body: unknown, init: RequestInit = {}) =>
  new Request('http://mailsink.test/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify(body),
    ...init,
  })

describeDb('MCP over stateless Streamable HTTP', (db) => {
  let bus: EventBus
  let ctx: McpContext
  beforeAll(async () => {
    bus = createEventBus()
    ctx = {
      db: db.db,
      bus,
      workspace: await createTestWorkspace(db.db),
      publicUrl: 'http://mailsink.test',
    }
  })

  it('answers 405 to GET and DELETE: no session, no standalone stream', async () => {
    for (const method of ['GET', 'DELETE']) {
      const res = await handleMcpRequest(new Request('http://mailsink.test/mcp', { method }), ctx)
      expect(res.status).toBe(405)
      expect(res.headers.get('allow')).toBe('POST')
    }
  })

  it('serves a tools/call without initialize nor session id', async () => {
    const res = await handleMcpRequest(
      post({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_emails' } }),
      ctx,
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('mcp-session-id')).toBeNull()
    expect(await res.text()).toContain('"data"')
    expect(bus.hasSubscribers(ctx.workspace.id)).toBe(false)
  })

  it('ends a pending call when the workspace is deleted, leaving no subscriber', async () => {
    const client = await connectClient(ctx)
    const pending = client.callTool({ name: 'wait_for_email', arguments: { subject: 'never' } })
    await new Promise((r) => setTimeout(r, 50))
    expect(bus.hasSubscribers(ctx.workspace.id)).toBe(true)
    const startedAt = Date.now()
    bus.publish(ctx.workspace.id, {
      id: null,
      connectionId: null,
      event: { type: 'workspace.deleted', workspaceId: ctx.workspace.id },
    })
    expect(toolJson(await pending)).toMatchObject({
      isError: true,
      json: { error: { code: 'not_found', message: 'Workspace not found' } },
    })
    expect(Date.now() - startedAt).toBeLessThan(DELETED_GRACE_MS)
    await new Promise((r) => setTimeout(r, 20))
    expect(bus.hasSubscribers(ctx.workspace.id)).toBe(false)
    await client.close()
  }, 10_000)

  it('closes the server when the client goes away', async () => {
    const abort = new AbortController()
    const res = handleMcpRequest(
      post(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'wait_for_email', arguments: { subject: 'never' } },
        },
        { signal: abort.signal },
      ),
      ctx,
    )
    await new Promise((r) => setTimeout(r, 50))
    abort.abort()
    await res.then((r) => r.body?.cancel()).catch(() => {})
    expect(bus.hasSubscribers(ctx.workspace.id)).toBe(false)
  }, 10_000)
})
