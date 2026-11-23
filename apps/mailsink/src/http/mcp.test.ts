import { insertCapturedMessage } from '@mailsink/core/capture-testing'
import { apiLogs, workspaces } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../runtime/boot'
import type { Runtime } from '../runtime/container'
import { mcpApi } from './mcp'
import { ADMIN_KEY, installTestRuntime, seedWorkspace } from './test-fixtures'

/** An SDK client whose HTTP calls go to the route handler in process. */
async function connect(headers: Record<string, string>) {
  const client = new Client({ name: 'mailsink-test', version: '0.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL('http://mailsink.test/mcp'), {
    requestInit: { headers },
    fetch: (url, init) => mcpApi({ request: new Request(url, init) }),
  })
  await client.connect(transport)
  return client
}

const text = (result: unknown) =>
  JSON.parse((result as { content: { text: string }[] }).content[0]?.text ?? 'null')

describeDb('/mcp route', (ctx) => {
  let runtime: Runtime
  let a: Awaited<ReturnType<typeof seedWorkspace>>
  let b: Awaited<ReturnType<typeof seedWorkspace>>
  beforeAll(async () => {
    runtime = await installTestRuntime(ctx.handle)
    a = await seedWorkspace(ctx.db)
    b = await seedWorkspace(ctx.db)
  })
  afterAll(() => stopRuntime())

  it('refuses a call without a workspace key', async () => {
    const res = await mcpApi({
      request: new Request('http://mailsink.test/mcp', { method: 'POST', body: '{}' }),
    })
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toMatch(/Bearer/)
    const revoked = await mcpApi({
      request: new Request('http://mailsink.test/mcp', {
        method: 'POST',
        headers: { authorization: `Bearer ${a.revokedKey}` },
      }),
    })
    expect(revoked.status).toBe(401)
  })

  it('scopes the tools to the workspace of the key (mskw_, msk_ or admin + header)', async () => {
    const { id } = await insertCapturedMessage(ctx.db, a.workspace.id, { subject: 'For A' })
    await insertCapturedMessage(ctx.db, b.workspace.id, { subject: 'For B' })
    const variants: Record<string, string>[] = [
      { authorization: `Bearer ${a.workspaceKey}` },
      { authorization: `Bearer ${a.connectionKey}` },
      { authorization: `Bearer ${ADMIN_KEY}`, 'x-mailsink-workspace': a.workspace.id },
    ]
    for (const headers of variants) {
      const client = await connect(headers)
      const page = text(await client.callTool({ name: 'list_emails', arguments: {} }))
      expect(page.data.map((m: { id: string }) => m.id)).toEqual([id])
      await client.close()
    }
  })

  it('answers 405 to GET and DELETE once authenticated', async () => {
    for (const method of ['GET', 'DELETE']) {
      const res = await mcpApi({
        request: new Request('http://mailsink.test/mcp', {
          method,
          headers: { authorization: `Bearer ${a.workspaceKey}` },
        }),
      })
      expect(res.status).toBe(405)
    }
  })

  it('touches the workspace activity and logs the call with dialect mcp', async () => {
    const old = new Date('2020-01-01T00:00:00Z')
    await ctx.db
      .update(workspaces)
      .set({ lastActivityAt: old })
      .where(eq(workspaces.id, b.workspace.id))
    const client = await connect({ authorization: `Bearer ${b.workspaceKey}` })
    await client.callTool({ name: 'get_override_config', arguments: {} })
    await client.close()
    await runtime.activity.flush()
    const [row] = await ctx.db.select().from(workspaces).where(eq(workspaces.id, b.workspace.id))
    expect(row?.lastActivityAt.getTime()).toBeGreaterThan(old.getTime())

    await runtime.logs.flush()
    const logs = await ctx.db.select().from(apiLogs).where(eq(apiLogs.workspaceId, b.workspace.id))
    expect(logs.length).toBeGreaterThan(0)
    expect(logs.every((l) => l.dialect === 'mcp' && l.path === '/mcp')).toBe(true)
    expect(JSON.stringify(logs.map((l) => l.requestBody))).toContain('get_override_config')
  })
})
