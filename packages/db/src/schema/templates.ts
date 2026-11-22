import { integer, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { createdAt } from './columns'
import type { Address } from './json-types'
import { workspaces } from './workspaces'

// Brevo `templateId` support.
export const templates = pgTable(
  'templates',
  {
    id: text('id').primaryKey(), // tpl_…
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    externalId: integer('external_id').notNull(), // Brevo numeric id
    name: text('name').notNull(),
    subject: text('subject').notNull(), // may contain {{ params.x }}
    html: text('html'),
    text: text('text'),
    sender: jsonb('sender').$type<Address>(),
    createdAt: createdAt(),
    updatedAt: createdAt('updated_at'),
  },
  (t) => [uniqueIndex('templates_external_uq').on(t.workspaceId, t.externalId)],
)
