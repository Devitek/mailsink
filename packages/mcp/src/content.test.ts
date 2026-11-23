import { MAILSINK_VERSION } from '@mailsink/contracts'
import { createEventBus } from '@mailsink/core'
import { insertCapturedMessage } from '@mailsink/core/capture-testing'
import { createTestWorkspaceWithConnection, describeDb } from '@mailsink/db/testing'
import type { Client } from '@modelcontextprotocol/client'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { McpContext } from './context'
import { connectClient, toolJson } from './testing'

const PUBLIC_URL = 'https://mail.example.com'
const RAW = 'From: app@example.com\r\nSubject: Hi\r\n\r\nHello'

// biome-ignore lint/suspicious/noExplicitAny: tests read arbitrary tool content
type Content = any[]

describeDb('MCP content tools', (db) => {
  let ctx: McpContext
  let client: Client
  beforeAll(async () => {
    const { workspace } = await createTestWorkspaceWithConnection(db.db)
    ctx = { db: db.db, bus: createEventBus(), workspace, publicUrl: PUBLIC_URL }
    client = await connectClient(ctx)
  })
  afterAll(() => client.close())

  const content = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args })
    return { isError: result.isError === true, content: result.content as Content }
  }

  it('announces the release version', () => {
    expect(client.getServerVersion()).toMatchObject({ name: 'mailsink', version: MAILSINK_VERSION })
  })

  it('answers absolute raw and download URLs in get_email', async () => {
    const msg = await insertCapturedMessage(db.db, ctx.workspace.id, {
      raw: RAW,
      attachments: [{ filename: 'a.txt', contentType: 'text/plain', content: 'note' }],
    })
    const res = toolJson(await client.callTool({ name: 'get_email', arguments: { id: msg.id } }))
    expect(res.json.rawUrl).toBe(`${PUBLIC_URL}/capture/messages/${msg.id}/raw`)
    expect(res.json.attachments[0].downloadUrl).toMatch(
      new RegExp(`^${PUBLIC_URL}/capture/messages/${msg.id}/attachments/att_`),
    )
  })

  it('returns the raw MIME source as an embedded resource', async () => {
    const msg = await insertCapturedMessage(db.db, ctx.workspace.id, { raw: RAW })
    const res = await content('get_email_source', { id: msg.id })
    expect(res.isError).toBe(false)
    expect(JSON.parse(res.content[0].text)).toMatchObject({ id: msg.id, sizeBytes: RAW.length })
    expect(res.content[1]).toEqual({
      type: 'resource',
      resource: {
        uri: `${PUBLIC_URL}/capture/messages/${msg.id}/raw`,
        mimeType: 'message/rfc822',
        text: RAW,
      },
    })
    const none = await insertCapturedMessage(db.db, ctx.workspace.id)
    const missing = toolJson(
      await client.callTool({ name: 'get_email_source', arguments: { id: none.id } }),
    )
    expect(missing).toMatchObject({ isError: true, json: { error: { code: 'not_found' } } })
  })

  it('returns text attachments as text and binary ones as base64', async () => {
    const bytes = new Uint8Array([0, 1, 2, 255])
    const msg = await insertCapturedMessage(db.db, ctx.workspace.id, {
      attachments: [
        { filename: 'a.txt', contentType: 'text/plain', content: 'note' },
        { filename: 'b.bin', contentType: 'application/octet-stream', content: bytes },
      ],
    })
    const detail = toolJson(
      await client.callTool({ name: 'get_email', arguments: { id: msg.id } }),
    ).json
    const [text, binary] = detail.attachments as { id: string; filename: string }[]
    const byName = [text, binary].sort((a, b) =>
      (a?.filename ?? '').localeCompare(b?.filename ?? ''),
    )
    const first = await content('get_email_attachment', { id: msg.id, attachmentId: byName[0]?.id })
    expect(first.content[1].resource).toMatchObject({ mimeType: 'text/plain', text: 'note' })
    expect(JSON.parse(first.content[0].text)).toMatchObject({ filename: 'a.txt', encoding: 'text' })
    const second = await content('get_email_attachment', {
      id: msg.id,
      attachmentId: byName[1]?.id,
    })
    expect(second.content[1].resource).toMatchObject({
      mimeType: 'application/octet-stream',
      blob: Buffer.from(bytes).toString('base64'),
    })
    const missing = toolJson(
      await client.callTool({
        name: 'get_email_attachment',
        arguments: { id: msg.id, attachmentId: 'att_missing' },
      }),
    )
    expect(missing.json.error.code).toBe('not_found')
  })
})
