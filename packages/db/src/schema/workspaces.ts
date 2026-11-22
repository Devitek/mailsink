import type { RateLimitSettings, SimulationSettings } from '@mailsink/contracts'
import { sql } from 'drizzle-orm'
import { boolean, index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { createdAt, tstz } from './columns'

/** Default of `workspaces.simulation`: the defaults of the SimulationSettings contract. */
export const DEFAULT_SIMULATION_SETTINGS: SimulationSettings = {
  rates: { delivered: 100 },
  rules: [],
  latency: { minMs: 0, maxMs: 0 },
  openRate: 0,
  clickRate: 0,
}

export const workspaces = pgTable(
  'workspaces',
  {
    id: text('id').primaryKey(), // ws_…
    slug: text('slug').notNull().unique(), // acme-studio-staging
    name: text('name').notNull(),
    description: text('description'),
    ephemeral: boolean('ephemeral').notNull().default(false),
    idleTtlSeconds: integer('idle_ttl_seconds'), // null when persistent
    lastActivityAt: tstz('last_activity_at').notNull().defaultNow(),
    // Denormalized last_activity_at + idle_ttl_seconds, maintained by activity.ts,
    // so the GC query is an index range scan.
    expiresAt: tstz('expires_at'),
    retentionSeconds: integer('retention_seconds')
      .notNull()
      .default(7 * 86_400),
    maxMessages: integer('max_messages'), // null = unbounded
    rateLimit: jsonb('rate_limit').$type<RateLimitSettings>(), // null = unlimited
    simulation: jsonb('simulation')
      .$type<SimulationSettings>()
      .notNull()
      .default(DEFAULT_SIMULATION_SETTINGS),
    metadata: jsonb('metadata').$type<Record<string, string>>(), // e.g. CI run id
    timezone: text('timezone').notNull().default('UTC'), // Brevo webhook `date` (D23)
    createdVia: text('created_via', { enum: ['ui', 'admin_api'] }).notNull(),
    createdAt: createdAt(),
    updatedAt: createdAt('updated_at'),
  },
  (t) => [
    index('workspaces_expiry_idx').on(t.expiresAt).where(sql`${t.ephemeral}`),
    index('workspaces_picker_idx').on(t.ephemeral, t.name),
  ],
)
