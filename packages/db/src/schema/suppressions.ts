import { pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { createdAt } from './columns'
import { suppressionReason } from './enums'
import { messages } from './messages'
import { workspaces } from './workspaces'

export const suppressions = pgTable(
  'suppressions',
  {
    id: text('id').primaryKey(), // sup_…
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(), // lower-cased
    reason: suppressionReason('reason').notNull(),
    messageId: text('message_id').references(() => messages.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('suppressions_ws_email_uq').on(t.workspaceId, t.email)],
)
