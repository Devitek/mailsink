import { index, integer, pgTable, text } from 'drizzle-orm/pg-core'
import { blobs } from './blobs'
import { messages } from './messages'

export const attachments = pgTable(
  'attachments',
  {
    id: text('id').primaryKey(), // att_…
    messageId: text('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    filename: text('filename'),
    contentType: text('content_type').notNull(),
    contentId: text('content_id'), // inline cid:
    disposition: text('disposition', { enum: ['attachment', 'inline'] }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    // Cascade (spec: no action): with no action, the workspace cascade fails when Postgres
    // deletes the blob before the attachment row. Orphan-only blob GC never triggers it.
    blobId: text('blob_id')
      .notNull()
      .references(() => blobs.id, { onDelete: 'cascade' }),
  },
  (t) => [
    index('attachments_message_idx').on(t.messageId),
    index('attachments_blob_idx').on(t.blobId), // workspace cascade through blobs
  ],
)
