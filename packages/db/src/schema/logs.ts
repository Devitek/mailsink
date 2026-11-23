import { boolean, index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { createdAt, tstz } from './columns'
import { connections } from './connections'
import { apiDialect, smtpOutcome } from './enums'
import type { TranscriptLine } from './json-types'
import { workspaces } from './workspaces'

export const apiLogs = pgTable(
  'api_logs',
  {
    id: text('id').primaryKey(), // req_… (X-Request-Id)
    // null on auth failure
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    connectionId: text('connection_id').references(() => connections.id, {
      onDelete: 'set null',
    }),
    dialect: apiDialect('dialect').notNull(),
    method: text('method').notNull(),
    path: text('path').notNull(),
    statusCode: integer('status_code').notNull(),
    durationMs: integer('duration_ms').notNull(),
    requestHeaders: jsonb('request_headers').$type<Record<string, string>>(), // redacted
    requestBody: jsonb('request_body'), // attachments stripped
    responseHeaders: jsonb('response_headers').$type<Record<string, string>>(), // #112
    responseBody: jsonb('response_body'),
    messageIds: text('message_ids').array(),
    errorCode: text('error_code'), // rate_limited, chaos_500…
    ip: text('ip'),
    createdAt: createdAt(),
  },
  (t) => [index('api_logs_ws_time_idx').on(t.workspaceId, t.createdAt.desc())],
)

export const smtpSessions = pgTable(
  'smtp_sessions',
  {
    id: text('id').primaryKey(), // smtp_…
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    connectionId: text('connection_id').references(() => connections.id, {
      onDelete: 'set null',
    }),
    remoteAddress: text('remote_address').notNull(),
    clientHostname: text('client_hostname'),
    authUser: text('auth_user'),
    secure: boolean('secure').notNull().default(false),
    transcript: jsonb('transcript').$type<TranscriptLine[]>().notNull(), // capped, AUTH redacted
    messageIds: text('message_ids').array(),
    outcome: smtpOutcome('outcome').notNull(),
    error: text('error'),
    startedAt: tstz('started_at').notNull(),
    endedAt: tstz('ended_at'),
  },
  (t) => [index('smtp_sessions_ws_time_idx').on(t.workspaceId, t.startedAt.desc())],
)
