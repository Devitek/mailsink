import { sql } from 'drizzle-orm'
import { expect, it } from 'vitest'
import type { Database } from '../src/client'
import { migrate } from '../src/migrate'
import { describeDb } from '../src/testing'

const TABLES = [
  'api_keys',
  'api_logs',
  'attachments',
  'blobs',
  'connections',
  'idempotency_keys',
  'jobs',
  'message_events',
  'message_recipients',
  'messages',
  'overrides',
  'smtp_sessions',
  'suppressions',
  'templates',
  'webhook_attempts',
  'webhook_deliveries',
  'webhook_endpoints',
  'workspaces',
]

async function publicTables(ctx: { db: Database }) {
  const result = await ctx.db.execute<{ table_name: string }>(
    sql`select table_name from information_schema.tables
        where table_schema = 'public' order by table_name`,
  )
  return result.rows.map((r) => r.table_name)
}

describeDb(
  'migrate',
  (ctx) => {
    it('starts from an empty database', async () => {
      expect(await publicTables(ctx)).toEqual([])
    })

    it('creates every table of the schema', async () => {
      await migrate(ctx.handle)
      expect(await publicTables(ctx)).toEqual(TABLES)
    })

    it('is idempotent', async () => {
      await migrate(ctx.handle)
      await Promise.all([migrate(ctx.handle), migrate(ctx.handle)])
      const applied = await ctx.db.execute<{ n: number }>(
        sql`select count(*)::int as n from drizzle.__drizzle_migrations`,
      )
      expect(applied.rows[0]?.n).toBe(1)
    })
  },
  { migrate: false },
)
