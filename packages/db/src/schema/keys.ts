import { sql } from 'drizzle-orm'
import { check, pgTable, text } from 'drizzle-orm/pg-core'
import { createdAt, tstz } from './columns'
import { connections } from './connections'
import { apiKeyScope } from './enums'
import { workspaces } from './workspaces'

export const apiKeys = pgTable(
  'api_keys',
  {
    id: text('id').primaryKey(), // key_…
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    connectionId: text('connection_id').references(() => connections.id, {
      onDelete: 'cascade',
    }),
    scope: apiKeyScope('scope').notNull(), // D12
    name: text('name'),
    displayPrefix: text('display_prefix').notNull(), // "msk_live_3f9a…"
    hash: text('hash').notNull().unique(), // sha256(key) (D11)
    lastUsedAt: tstz('last_used_at'),
    revokedAt: tstz('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [
    check('api_keys_scope', sql`(${t.scope} = 'connection') = (${t.connectionId} is not null)`),
  ],
)
