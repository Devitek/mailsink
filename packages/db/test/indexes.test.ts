import type { PGlite } from '@electric-sql/pglite'
import { sql } from 'drizzle-orm'
import type pg from 'pg'
import { beforeAll, expect, it } from 'vitest'
import { searchMessagesQuery } from '../src/repositories/messages-read'
import { messages } from '../src/schema'
import { searchDocument } from '../src/search-document'
import { createTestMessage, createTestWorkspace, describeDb, type TestDb } from '../src/testing'

// Foreign keys Postgres does not index on its own: cascades and joins need these.
const FK_INDEXES = [
  ['attachments', 'attachments_message_idx', '(message_id)'],
  ['attachments', 'attachments_blob_idx', '(blob_id)'],
  ['webhook_attempts', 'attempts_delivery_idx', '(delivery_id)'],
  ['messages', 'messages_raw_blob_idx', '(raw_blob_id)'],
] as const

describeDb('foreign key indexes', (ctx) => {
  it.each(FK_INDEXES)('indexes %s with %s', async (table, name, columns) => {
    const result = await ctx.db.execute<{ indexdef: string }>(
      sql`select indexdef from pg_indexes
          where schemaname = 'public' and tablename = ${table} and indexname = ${name}`,
    )
    expect(result.rows[0]?.indexdef).toMatch(`USING btree ${columns}`)
  })
})

/** Plan of a query with sequential scans disabled: the index it can use, if any. */
async function plan(handle: TestDb, query: { sql: string; params: unknown[] }): Promise<string> {
  type Query = (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>
  const explain = async (run: Query) => {
    await run('set enable_seqscan = off')
    try {
      const { rows } = await run(`explain ${query.sql}`, query.params)
      return rows.map((row) => Object.values(row as object).join('')).join('\n')
    } finally {
      await run('reset enable_seqscan')
    }
  }
  if (handle.driver === 'pglite') {
    const client = handle.client as PGlite
    return explain((text, params) => client.query(text, params))
  }
  const conn = await (handle.client as pg.Pool).connect()
  try {
    return await explain((text, params) => conn.query(text, params))
  } finally {
    conn.release()
  }
}

describeDb('capture search indexes', (ctx) => {
  let workspaceId = ''
  beforeAll(async () => {
    workspaceId = (await createTestWorkspace(ctx.db)).id
    for (const subject of ['Welcome', 'Invoice', 'Reset password']) {
      await createTestMessage(ctx.db, workspaceId, { subject })
    }
  })

  it('matches the full text expression of messages_search_gin', async () => {
    // The page query may still prefer the workspace index on a small workspace: what must
    // hold is that the search expression is the indexed one.
    const query = ctx.db
      .select({ id: messages.id })
      .from(messages)
      .where(sql`${searchDocument(messages)} @@ websearch_to_tsquery('simple', ${'invoice'})`)
    expect(await plan(ctx.handle, query.toSQL())).toContain('messages_search_gin')
  })

  it('indexes a body whose full tsvector would exceed the 1 MB cap', async () => {
    const html = Array.from({ length: 250_000 }, (_, i) => `w${i}`).join(' ')
    const row = await createTestMessage(ctx.db, workspaceId, { subject: 'Huge', html })
    const found = await ctx.db
      .select({ id: messages.id })
      .from(messages)
      .where(sql`${searchDocument(messages)} @@ websearch_to_tsquery('simple', ${'w42'})`)
    expect(found.map((f) => f.id)).toEqual([row.id])
  })

  it('serves the keyset page from messages_ws_created_idx', async () => {
    const after = { createdAt: new Date().toISOString(), id: 'msg_z' }
    const query = searchMessagesQuery(ctx.db, { workspaceId, after, limit: 50 })
    expect(await plan(ctx.handle, query.toSQL())).toContain('messages_ws_created_idx')
  })
})
