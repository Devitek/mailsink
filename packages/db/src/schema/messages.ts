import { index, integer, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { blobs } from './blobs'
import { createdAt } from './columns'
import { connections } from './connections'
import { deliveryStatus, messageSource, recipientKind } from './enums'
import type { Address } from './json-types'
import { workspaces } from './workspaces'

export const messages = pgTable(
  'messages',
  {
    id: text('id').primaryKey(), // msg_…
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    connectionId: text('connection_id').references(() => connections.id, {
      onDelete: 'set null',
    }),
    source: messageSource('source').notNull(),
    providerMessageId: text('provider_message_id').notNull(), // Resend uuid, Brevo <…@…>
    from: jsonb('from').$type<Address>().notNull(),
    replyTo: jsonb('reply_to').$type<Address[]>(),
    subject: text('subject').notNull().default(''),
    html: text('html'),
    text: text('text'),
    headers: jsonb('headers').$type<Record<string, string>>().notNull().default({}),
    tags: jsonb('tags').$type<{ name: string; value: string }[]>().notNull().default([]),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    templateRef: jsonb('template_ref').$type<{
      templateId: number
      params: Record<string, unknown>
    }>(),
    links: jsonb('links').$type<{ url: string; text?: string }[]>().notNull().default([]),
    // D9. Set null (spec: no action), same workspace cascade ordering issue as attachments.
    rawBlobId: text('raw_blob_id').references(() => blobs.id, { onDelete: 'set null' }),
    sizeBytes: integer('size_bytes').notNull(),
    status: deliveryStatus('status').notNull().default('queued'), // aggregate of recipients
    // Snapshot of what the simulation decided: overrideId, rule matched, latencyMs…
    simulation: jsonb('simulation').$type<Record<string, unknown>>(),
    idempotencyKey: text('idempotency_key'),
    createdAt: createdAt(),
    statusUpdatedAt: createdAt('status_updated_at'),
  },
  (t) => [
    index('messages_ws_created_idx').on(t.workspaceId, t.createdAt.desc()),
    index('messages_ws_status_idx').on(t.workspaceId, t.status),
    index('messages_ws_connection_idx').on(t.workspaceId, t.connectionId, t.createdAt.desc()),
    index('messages_tags_gin').using('gin', t.tags),
    uniqueIndex('messages_provider_id_uq').on(t.workspaceId, t.providerMessageId),
  ],
)

export const messageRecipients = pgTable(
  'message_recipients',
  {
    id: text('id').primaryKey(), // rcp_…
    messageId: text('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').notNull(), // denormalized for search
    kind: recipientKind('kind').notNull(),
    email: text('email').notNull(), // lower-cased
    name: text('name'),
    status: deliveryStatus('status').notNull().default('queued'),
    statusReason: text('status_reason'), // "rule *+bounce@*"
    updatedAt: createdAt('updated_at'),
  },
  (t) => [
    index('recipients_ws_email_idx').on(t.workspaceId, t.email),
    index('recipients_message_idx').on(t.messageId),
  ],
)
