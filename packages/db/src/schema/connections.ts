import type { RateLimitSettings, SimulationSettingsPatch } from '@mailsink/contracts'
import { sql } from 'drizzle-orm'
import { check, index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { createdAt, tstz } from './columns'
import { connectionKind } from './enums'
import { workspaces } from './workspaces'

export const connections = pgTable(
  'connections',
  {
    id: text('id').primaryKey(), // con_…
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // "Brevo - Transactionnel"
    kind: connectionKind('kind').notNull(),
    smtpUsername: text('smtp_username').unique(), // kind = smtp only
    smtpPasswordHash: text('smtp_password_hash'), // scrypt (D11)
    // Per-connection overrides of workspace defaults; null = inherit.
    retentionSeconds: integer('retention_seconds'),
    rateLimit: jsonb('rate_limit').$type<RateLimitSettings>(),
    simulation: jsonb('simulation').$type<SimulationSettingsPatch>(),
    disabledAt: tstz('disabled_at'),
    createdAt: createdAt(),
    updatedAt: createdAt('updated_at'),
  },
  (t) => [
    index('connections_workspace_idx').on(t.workspaceId),
    check('connections_smtp_creds', sql`(${t.kind} = 'smtp') = (${t.smtpUsername} is not null)`),
  ],
)
