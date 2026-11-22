import { ListMessagesQuery } from '@mailsink/contracts'
import { createTestWorkspaceWithConnection, describeDb } from '@mailsink/db/testing'
import { beforeAll, expect, it } from 'vitest'
import { listCapturedMessages } from './service'
import { insertCapturedMessage } from './testing/fixtures'

const at = (minute: number) => new Date(Date.UTC(2026, 10, 22, 10, minute))

describeDb('capture: list and filters', (ctx) => {
  let ws: string
  let con: string
  const ids: Record<string, string> = {}
  const list = async (q: Record<string, unknown> = {}) =>
    listCapturedMessages(ctx.db, ws, ListMessagesQuery.parse(q))
  const found = async (q: Record<string, unknown>) =>
    (await list(q)).data.map((m) => Object.keys(ids).find((k) => ids[k] === m.id))

  beforeAll(async () => {
    const seeded = await createTestWorkspaceWithConnection(ctx.db)
    ws = seeded.workspace.id
    con = seeded.connection.id
    const add = async (key: string, f: Parameters<typeof insertCapturedMessage>[2]) => {
      ids[key] = (await insertCapturedMessage(ctx.db, ws, f)).id
    }
    await add('welcome', {
      createdAt: at(1),
      subject: 'Welcome aboard',
      to: [{ email: 'jane@acme.io', name: 'Jane Doe' }],
      tags: [{ name: 'category', value: 'welcome' }],
      text: 'Thanks for joining',
      html: '<p>Thanks for <b>joining</b></p>',
    })
    await add('reset', {
      createdAt: at(2),
      connectionId: con,
      subject: 'Reset your password',
      from: { email: 'security@acme.io', name: 'Security' },
      to: ['bob@corp.io'],
      cc: ['audit@corp.io'],
      status: 'hard_bounce',
      tags: [{ name: 'category', value: 'security' }],
      text: 'Click to reset the password',
      attachments: [{ contentType: 'application/pdf', content: 'pdf' }],
    })
    await add('invoice', {
      createdAt: at(3),
      subject: 'Invoice 100%_paid',
      to: ['jane@acme.io'],
      status: 'failed',
      html: '<p>Your invoice is attached</p>',
      text: null,
      attachments: [{ contentType: 'image/png', content: 'png', disposition: 'inline' }],
    })
    // Another workspace with matching data: never listed.
    const other = await createTestWorkspaceWithConnection(ctx.db)
    await insertCapturedMessage(ctx.db, other.workspace.id, { subject: 'Welcome aboard' })
  })

  it('lists the workspace messages newest first as MessageSummary', async () => {
    const page = await list()
    expect(page.nextCursor).toBeNull()
    expect(page.data.map((m) => m.id)).toEqual([ids.invoice, ids.reset, ids.welcome])
    expect(page.data[1]).toEqual({
      id: ids.reset,
      connectionId: con,
      source: 'native',
      from: { email: 'security@acme.io', name: 'Security' },
      to: [{ email: 'bob@corp.io', name: null }],
      subject: 'Reset your password',
      status: 'hard_bounce',
      tags: [{ name: 'category', value: 'security' }],
      hasAttachments: true,
      createdAt: at(2).toISOString(),
    })
    // An inline part alone is not an attachment.
    expect(page.data[0]?.hasAttachments).toBe(false)
  })

  it('filters by recipient, sender and subject substrings, case-insensitively', async () => {
    expect(await found({ to: 'JANE' })).toEqual(['invoice', 'welcome'])
    expect(await found({ to: 'jane doe' })).toEqual(['welcome'])
    expect(await found({ to: 'audit@' })).toEqual(['reset'])
    expect(await found({ from: 'SECURITY' })).toEqual(['reset'])
    expect(await found({ subject: 'aboard' })).toEqual(['welcome'])
    // LIKE wildcards in the input are literal characters.
    expect(await found({ subject: '100%_' })).toEqual(['invoice'])
    expect(await found({ subject: '%' })).toEqual(['invoice'])
  })

  it('filters by tag name or name:value', async () => {
    expect(await found({ tag: 'category' })).toEqual(['reset', 'welcome'])
    expect(await found({ tag: 'category:security' })).toEqual(['reset'])
    expect(await found({ tag: 'category:nope' })).toEqual([])
  })

  it('filters by status (single, comma list, repeated) and connection', async () => {
    expect(await found({ status: 'failed' })).toEqual(['invoice'])
    expect(await found({ status: 'failed,hard_bounce' })).toEqual(['invoice', 'reset'])
    expect(await found({ status: ['delivered', 'failed'] })).toEqual(['invoice', 'welcome'])
    expect(await found({ connectionId: con })).toEqual(['reset'])
  })

  it('filters by date range, bounds included', async () => {
    expect(await found({ since: at(2).toISOString() })).toEqual(['invoice', 'reset'])
    expect(await found({ until: at(2).toISOString() })).toEqual(['reset', 'welcome'])
    expect(await found({ since: at(2).toISOString(), until: at(2).toISOString() })).toEqual([
      'reset',
    ])
  })

  it('searches full text in subject, text and HTML bodies', async () => {
    expect(await found({ q: 'password' })).toEqual(['reset'])
    expect(await found({ q: 'joining' })).toEqual(['welcome'])
    expect(await found({ q: 'INVOICE attached' })).toEqual(['invoice'])
    expect(await found({ q: 'thanks -joining' })).toEqual([])
    expect(await found({ q: 'b' })).toEqual([]) // HTML tags are not indexed
    expect(await found({ q: '   ' })).toEqual(['invoice', 'reset', 'welcome'])
  })

  it('combines filters', async () => {
    expect(await found({ to: 'jane', status: 'delivered', q: 'thanks' })).toEqual(['welcome'])
  })

  it('paginates with an opaque cursor, without gaps or duplicates', async () => {
    const first = await list({ limit: 2 })
    expect(first.data.map((m) => m.id)).toEqual([ids.invoice, ids.reset])
    expect(first.nextCursor).toEqual(expect.any(String))
    const second = await list({ limit: 2, cursor: first.nextCursor })
    expect(second.data.map((m) => m.id)).toEqual([ids.welcome])
    expect(second.nextCursor).toBeNull()
  })

  it('keeps the cursor exact for rows sharing a timestamp to the microsecond', async () => {
    const { workspace } = await createTestWorkspaceWithConnection(ctx.db)
    const same = new Date('2026-11-22T12:00:00.000Z')
    const made = []
    for (let i = 0; i < 5; i++) {
      made.push((await insertCapturedMessage(ctx.db, workspace.id, { createdAt: same })).id)
    }
    const seen: string[] = []
    let cursor: string | null | undefined
    do {
      const page = await listCapturedMessages(
        ctx.db,
        workspace.id,
        ListMessagesQuery.parse({ limit: 2, cursor: cursor ?? undefined }),
      )
      seen.push(...page.data.map((m) => m.id))
      cursor = page.nextCursor
    } while (cursor)
    expect(seen).toEqual([...made].sort().reverse())
  })
})
