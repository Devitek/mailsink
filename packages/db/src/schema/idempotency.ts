import { integer, jsonb, pgTable, primaryKey, text } from 'drizzle-orm/pg-core'
import { tstz } from './columns'
import { workspaces } from './workspaces'

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    requestHash: text('request_hash').notNull(), // mismatch -> 409/422
    responseStatus: integer('response_status').notNull(),
    responseBody: jsonb('response_body').notNull(),
    expiresAt: tstz('expires_at').notNull(), // now + 24 h
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.key] })],
)
