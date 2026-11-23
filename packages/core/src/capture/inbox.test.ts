import { ListMessagesQuery } from '@mailsink/contracts'
import { apiLogs, newId } from '@mailsink/db'
import {
  createTestConnection,
  createTestWorkspace,
  createTestWorkspaceWithConnection,
  describeDb,
} from '@mailsink/db/testing'
import { beforeAll, expect, it } from 'vitest'
import { listInboxRows, readInboxFacets, readMessagePreviews } from './inbox'
import { insertCapturedMessage } from './testing/fixtures'

describeDb('capture: web UI inbox', (ctx) => {
  let ws: string
  let resend: string
  let smtp: string
  const ids: Record<string, string> = {}

  beforeAll(async () => {
    const seeded = await createTestWorkspaceWithConnection(ctx.db)
    ws = seeded.workspace.id
    resend = seeded.connection.id
    smtp = (
      await createTestConnection(ctx.db, ws, {
        kind: 'smtp',
        name: 'SMTP relay',
        smtpUsername: `relay-${ws}`,
        smtpPasswordHash: 'scrypt$test',
      })
    ).id
    await createTestConnection(ctx.db, ws, { kind: 'brevo', name: 'Brevo idle' })
    const add = async (key: string, f: Parameters<typeof insertCapturedMessage>[2]) => {
      ids[key] = (await insertCapturedMessage(ctx.db, ws, f)).id
    }
    await add('html', {
      connectionId: resend,
      text: null,
      html: '<style>p{}</style><p>Your booking&nbsp;is confirmed</p>',
    })
    await add('text', { connectionId: resend, text: 'Invoice\n\nattached', status: 'hard_bounce' })
    await add('empty', { connectionId: smtp, text: '', html: null, status: 'hard_bounce' })
    await add('orphan', { connectionId: null })
    await ctx.db.insert(apiLogs).values({
      id: newId('req'),
      workspaceId: ws,
      dialect: 'native',
      method: 'POST',
      path: '/v1/emails',
      statusCode: 200,
      durationMs: 3,
    })
    // Another workspace's rows never count.
    const other = await createTestWorkspace(ctx.db)
    await insertCapturedMessage(ctx.db, other.id, {})
  })

  it('counts the whole inbox per status and per connection, and the log rows', async () => {
    const facets = await readInboxFacets(ctx.db, ws)
    expect(facets.total).toBe(4)
    expect(facets.byStatus).toEqual({ delivered: 2, hard_bounce: 2 })
    expect(facets.connections.map((c) => [c.kind, c.name, c.count])).toEqual([
      ['resend', 'Resend', 2],
      ['smtp', 'SMTP relay', 1],
      ['brevo', 'Brevo idle', 0],
    ])
    expect(facets.logs).toBe(1)
  })

  it('lists rows with a plain text preview, text body first', async () => {
    const page = await listInboxRows(ctx.db, ws, ListMessagesQuery.parse({ limit: 10 }))
    const preview = (key: string) => page.data.find((m) => m.id === ids[key])?.preview
    expect(preview('html')).toBe('Your booking is confirmed')
    expect(preview('text')).toBe('Invoice attached')
    expect(preview('empty')).toBe('')
    expect(page.data).toHaveLength(4)
  })

  it('reads previews of the workspace only', async () => {
    const other = await createTestWorkspace(ctx.db)
    const foreign = await insertCapturedMessage(ctx.db, other.id, { text: 'secret' })
    const previews = await readMessagePreviews(ctx.db, ws, [ids.text as string, foreign.id])
    expect(previews).toEqual({ [ids.text as string]: 'Invoice attached' })
    expect(await readMessagePreviews(ctx.db, ws, [])).toEqual({})
  })
})
