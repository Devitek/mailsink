import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { createdAt } from './columns'
import { connections } from './connections'
import { brevoAuthType, payloadFormat, webhookEvent } from './enums'
import { workspaces } from './workspaces'

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: text('id').primaryKey(), // whe_…
    // Numeric id required by the Brevo payload (`id` = webhook id).
    numericId: integer('numeric_id').generatedAlwaysAsIdentity().notNull().unique(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    // Scope: a connection (only its emails) or null = Workspace (every connection).
    connectionId: text('connection_id').references(() => connections.id, {
      onDelete: 'cascade',
    }),
    url: text('url').notNull(),
    // Default at creation: connection kind for resend/brevo, 'unified' for smtp or
    // workspace scope. Always explicitly settable (D20).
    payloadFormat: payloadFormat('payload_format').notNull(),
    events: webhookEvent('events').array().notNull(), // canonical only (D22)
    // unified: HMAC key; resend: whsec_<base64> Svix key; brevo: bearer token or
    // "user:password" for basic auth (D11: stored in clear because it signs/authenticates).
    secret: text('secret'),
    brevoAuth: brevoAuthType('brevo_auth').notNull().default('none'),
    // Brevo `headers` parity
    customHeaders: jsonb('custom_headers')
      .$type<{ key: string; value: string }[]>()
      .notNull()
      .default([]),
    description: text('description'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: createdAt('updated_at'),
  },
  (t) => [
    index('webhook_endpoints_scope_idx').on(t.workspaceId, t.connectionId),
    check('webhook_secret_required', sql`${t.payloadFormat} = 'brevo' or ${t.secret} is not null`),
  ],
)
