import { sql } from 'drizzle-orm'
import { expect, it } from 'vitest'
import { describeDb } from '../src/testing'

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
