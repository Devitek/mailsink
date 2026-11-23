import { execFileSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import { PassThrough } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { createEventBus } from '@mailsink/core'
import { insertCapturedMessage } from '@mailsink/core/capture-testing'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import type { McpContext } from '@mailsink/mcp'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mcpCommand, mcpEndpoint } from '../src/commands/mcp'
import { run } from '../src/index'
import { type FakeInstance, startFakeInstance } from './mcp-server'

const KEY = 'mskw_test-key'
const packageDir = fileURLToPath(new URL('..', import.meta.url))
const silent = { out: () => {}, err: () => {} }

describe('mailsink mcp options', () => {
  it('names the endpoint from a base URL or the /mcp URL', () => {
    expect(mcpEndpoint('http://localhost:3000').href).toBe('http://localhost:3000/mcp')
    expect(mcpEndpoint('https://sink.test/base/').href).toBe('https://sink.test/base/mcp')
    expect(mcpEndpoint('https://sink.test/mcp').href).toBe('https://sink.test/mcp')
    expect(() => mcpEndpoint('ftp://sink.test')).toThrow(/MAILSINK_URL/)
    expect(() => mcpEndpoint('nope')).toThrow(/MAILSINK_URL/)
  })

  it('needs a key', async () => {
    const lines: string[] = []
    const io = { out: (l: string) => lines.push(l), err: (l: string) => lines.push(l) }
    expect(await run(['mcp'], {}, io)).toBe(1)
    expect(lines.join('\n')).toMatch(/MAILSINK_KEY/)
  })
})

/** Raw JSON-RPC over the proxy's stdio, one line per message. */
function stdioPeer() {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const lines = createInterface({ input: stdout })[Symbol.asyncIterator]()
  return {
    stdin,
    stdout,
    async request(id: number, method: string, params: unknown = {}) {
      stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
      const { value } = await lines.next()
      return JSON.parse(value as string)
    },
  }
}

const initialize = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'raw', version: '0' },
}

describeDb('mailsink mcp proxy', (db) => {
  let ctx: McpContext
  let instance: FakeInstance
  let messageId: string
  beforeAll(async () => {
    ctx = { db: db.db, bus: createEventBus(), workspace: await createTestWorkspace(db.db) }
    messageId = (await insertCapturedMessage(db.db, ctx.workspace.id, { subject: 'Via stdio' })).id
    instance = await startFakeInstance(ctx, KEY)
  })
  afterAll(() => instance.close())

  it('forwards stdio messages to the HTTP endpoint with the key', async () => {
    const peer = stdioPeer()
    const done = mcpCommand({ url: instance.url, key: KEY, ...peer }, silent)
    const init = await peer.request(1, 'initialize', initialize)
    expect(init.result.serverInfo.name).toBe('mailsink')
    const call = await peer.request(2, 'tools/call', { name: 'list_emails', arguments: {} })
    expect(call.result.structuredContent.data[0].id).toBe(messageId)
    peer.stdin.end()
    await done
    const last = instance.seen.at(-1)
    expect(last?.get('authorization')).toBe(`Bearer ${KEY}`)
    expect(last?.get('mcp-protocol-version')).toBe('2025-06-18')
  })

  it('answers a JSON-RPC error when the endpoint refuses the key', async () => {
    const peer = stdioPeer()
    const errors: string[] = []
    const done = mcpCommand(
      { url: instance.url, key: 'mskw_wrong', ...peer },
      { out: () => {}, err: (l) => errors.push(l) },
    )
    const init = await peer.request(1, 'initialize', initialize)
    expect(init.error).toMatchObject({ code: -32000 })
    expect(init.error.message).toMatch(/unauthorized/)
    expect(errors.join('\n')).not.toContain('mskw_wrong')
    peer.stdin.end()
    await done
  })

  it('serves an SDK client through the built bin', async () => {
    execFileSync('pnpm', ['build'], { cwd: packageDir, stdio: 'ignore' })
    const client = new Client({ name: 'cli-test', version: '0' })
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [`${packageDir}/dist/bin.mjs`, 'mcp'],
        env: { PATH: process.env.PATH ?? '', MAILSINK_URL: instance.url, MAILSINK_KEY: KEY },
        stderr: 'ignore',
      }),
    )
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name)).toContain('wait_for_email')
    const result = await client.callTool({ name: 'get_email', arguments: { id: messageId } })
    expect(result.structuredContent).toMatchObject({ id: messageId, subject: 'Via stdio' })
    await client.close()
  }, 60_000)
})
