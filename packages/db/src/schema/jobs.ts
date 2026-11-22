import { bigserial, index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { tstz } from './columns'
import { workspaces } from './workspaces'

export const jobKinds = ['simulate_delivery', 'deliver_webhook'] as const
export type JobKind = (typeof jobKinds)[number]

// Postgres-backed queue (D5), claimed with FOR UPDATE SKIP LOCKED (repositories/jobs.ts).
export const jobs = pgTable(
  'jobs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    kind: text('kind', { enum: jobKinds }).notNull(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    payload: jsonb('payload').notNull(),
    runAt: tstz('run_at').notNull().defaultNow(),
    attempts: integer('attempts').notNull().default(0),
    lockedUntil: tstz('locked_until'),
    lastError: text('last_error'),
    // Set when the job is given up on (run_at parked at FAILED_JOB_RUN_AT): the retention
    // pass purges it once the grace period after this instant is over.
    failedAt: tstz('failed_at'),
  },
  (t) => [index('jobs_due_idx').on(t.runAt)],
)
