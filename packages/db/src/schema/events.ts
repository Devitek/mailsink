import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { tstz } from './columns'
import { eventOrigin, eventType } from './enums'
import { messages } from './messages'
import { workspaces } from './workspaces'

export const messageEvents = pgTable(
  'message_events',
  {
    id: text('id').primaryKey(), // evt_… (also SSE id)
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    messageId: text('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    recipientEmail: text('recipient_email'),
    type: eventType('type').notNull(),
    origin: eventOrigin('origin').notNull(),
    data: jsonb('data').$type<{
      url?: string
      userAgent?: string
      reason?: string
      smtpCode?: number
    }>(),
    occurredAt: tstz('occurred_at').notNull().defaultNow(),
  },
  (t) => [
    index('events_message_idx').on(t.messageId, t.occurredAt),
    index('events_ws_time_idx').on(t.workspaceId, t.occurredAt),
  ],
)
