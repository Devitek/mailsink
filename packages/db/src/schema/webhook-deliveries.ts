import { index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { createdAt, tstz } from './columns'
import { payloadFormat, replayMode, webhookDeliveryStatus, webhookEvent } from './enums'
import { messageEvents } from './events'
import { messages } from './messages'
import { webhookEndpoints } from './webhooks'
import { workspaces } from './workspaces'

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: text('id').primaryKey(), // whd_… (= svix-id, X-Mailsink-Delivery-Id)
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    endpointId: text('endpoint_id')
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
    eventId: text('event_id').references(() => messageEvents.id, { onDelete: 'set null' }),
    messageId: text('message_id').references(() => messages.id, { onDelete: 'set null' }),
    // Format snapshot: later endpoint edits never change what a delivery sends.
    payloadFormat: payloadFormat('payload_format').notNull(),
    canonicalEvent: webhookEvent('canonical_event').notNull(), // email.soft_bounced
    dialectEvent: text('dialect_event').notNull(), // email.delivery_delayed, soft_bounce…
    recipient: text('recipient'),
    // Exact serialized bytes, signed and sent as is by every attempt and replay (D24).
    body: text('body').notNull(),
    contentType: text('content_type').notNull().default('application/json'),
    status: webhookDeliveryStatus('status').notNull().default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: tstz('next_attempt_at'),
    lastStatusCode: integer('last_status_code'),
    replayOf: text('replay_of'), // whd_… of the original
    replayMode: replayMode('replay_mode'), // null unless a replay
    createdAt: createdAt(),
  },
  (t) => [
    index('deliveries_ws_time_idx').on(t.workspaceId, t.createdAt.desc()),
    index('deliveries_message_idx').on(t.messageId),
    index('deliveries_ws_format_idx').on(t.workspaceId, t.payloadFormat), // log facet
  ],
)

export const webhookAttempts = pgTable('webhook_attempts', {
  id: text('id').primaryKey(),
  deliveryId: text('delivery_id')
    .notNull()
    .references(() => webhookDeliveries.id, { onDelete: 'cascade' }),
  attemptNo: integer('attempt_no').notNull(),
  // Headers exactly as sent, signature headers included, unredacted: an `exact` replay
  // copies them byte for byte. The UI masks Authorization values behind a reveal toggle.
  requestHeaders: jsonb('request_headers').$type<Record<string, string>>().notNull(),
  signedAt: integer('signed_at'), // unix ts used to sign
  responseStatus: integer('response_status'),
  responseBody: text('response_body'), // truncated to 4 KB
  durationMs: integer('duration_ms').notNull(),
  error: text('error'), // DNS, timeout, TLS…
  createdAt: createdAt(),
})
