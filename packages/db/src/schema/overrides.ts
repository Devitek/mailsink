import { sql } from 'drizzle-orm'
import { jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { createdAt, tstz } from './columns'
import { connections } from './connections'
import { eventOrigin } from './enums'
import type { OverrideConfig } from './json-types'
import { workspaces } from './workspaces'

export const overrides = pgTable(
  'overrides',
  {
    id: text('id').primaryKey(), // ovr_…
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    // null = whole workspace
    connectionId: text('connection_id').references(() => connections.id, {
      onDelete: 'cascade',
    }),
    // rates, rules, latency, chaos, rateLimit
    config: jsonb('config').$type<OverrideConfig>().notNull(),
    activatedVia: eventOrigin('activated_via').notNull(),
    expiresAt: tstz('expires_at'), // optional auto-reset
    createdAt: createdAt(),
    resetAt: tstz('reset_at'), // null = active
  },
  (t) => [
    // At most one active override per scope; history is kept for the logs.
    uniqueIndex('overrides_active_scope_uq')
      .on(t.workspaceId, sql`coalesce(${t.connectionId}, '')`)
      .where(sql`${t.resetAt} is null`),
  ],
)
