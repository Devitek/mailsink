import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { migrate } from '../src/migrate'
import { createTestWorkspace, describeDb } from '../src/testing'
import { migrationsUpTo } from './journal'

describeDb(
  'jobs.failed_at backfill',
  (ctx) => {
    let legacy: Awaited<ReturnType<typeof migrationsUpTo>>

    beforeAll(async () => {
      // Database as 0001 left it: a job given up on only had its run_at parked.
      legacy = await migrationsUpTo('0001_fk_indexes_and_simulation_defaults')
      await migrate(ctx.handle, { migrationsFolder: legacy.folder })
      const ws = await createTestWorkspace(ctx.db)
      await ctx.db.execute(sql`insert into jobs (kind, workspace_id, payload, run_at) values
        ('simulate_delivery', ${ws.id}, '{}', '9999-12-31T00:00:00Z'),
        ('simulate_delivery', ${ws.id}, '{}', now())`)
      await migrate(ctx.handle)
    }, 60_000)
    afterAll(() => legacy?.dispose())

    it('starts the grace period of jobs failed before the migration', async () => {
      const result = await ctx.db.execute<{ failed: boolean }>(
        sql`select failed_at is not null as failed from jobs order by run_at desc`,
      )
      expect(result.rows.map((r) => r.failed)).toEqual([true, false])
    })
  },
  { migrate: false },
)
