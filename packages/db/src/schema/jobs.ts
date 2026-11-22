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
  },
  (t) => [index('jobs_due_idx').on(t.runAt)],
)
