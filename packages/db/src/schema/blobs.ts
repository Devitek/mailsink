import { integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { bytea, createdAt } from './columns'
import { workspaces } from './workspaces'

// Content-addressed binary store (D8). Orphan blobs (after message purge) are removed by
// the retention job.
export const blobs = pgTable(
  'blobs',
  {
    id: text('id').primaryKey(), // blob_…
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sha256: text('sha256').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    data: bytea('data').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('blobs_dedup_uq').on(t.workspaceId, t.sha256)],
)
