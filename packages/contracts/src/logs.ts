import { z } from 'zod'
import { IsoDateTime, issue } from './common'
import { ConnectionId, MessageId, prefixedId } from './ids'

// Request and SMTP session logs (03-contracts, « Logs », #35): read by the UI DataTables
// and MCP through `GET /capture/logs/api` and `GET /capture/logs/smtp`.

export const ApiLogId = prefixedId('req')
export const SmtpSessionId = prefixedId('smtp')

/** Mirrors the `api_dialect` pg enum: the HTTP surface a call hit. */
export const ApiDialect = z.enum(['native', 'resend', 'brevo', 'admin', 'capture', 'mcp'])
/** Mirrors the `smtp_outcome` pg enum. */
export const SmtpOutcome = z.enum(['accepted', 'rejected', 'auth_failed', 'error'])

const csv = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => (typeof v === 'string' ? v.split(',') : v), z.array(item))

/** Page-number pagination of the log tables (server side, with the total for the pager). */
export function NumberedPage<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  })
}

const paging = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
}

const sinceBeforeUntil = (q: { since?: string; until?: string }) =>
  !q.since || !q.until || Date.parse(q.since) <= Date.parse(q.until)
const sinceIssue = issue('since_after_until', 'since must be before until', ['until'])

/** One status code (`404`) or a class (`4xx`). */
export const StatusFilter = z
  .string()
  .regex(/^[1-5](\d\d|xx)$/, 'Expected a status such as 404 or 4xx')

export const ApiLogSort = z.enum([
  'createdAt',
  '-createdAt',
  'durationMs',
  '-durationMs',
  'statusCode',
  '-statusCode',
])

export const ListApiLogsQuery = z
  .object({
    connectionId: ConnectionId.optional(),
    dialect: csv(ApiDialect).optional(),
    status: csv(StatusFilter).optional(),
    errorCode: z.string().optional(),
    method: z
      .string()
      .transform((m) => m.toUpperCase())
      .optional(),
    path: z.string().optional(), // substring, case-insensitive
    messageId: MessageId.optional(),
    since: IsoDateTime.optional(),
    until: IsoDateTime.optional(),
    sort: ApiLogSort.default('-createdAt'),
    ...paging,
  })
  .refine(sinceBeforeUntil, sinceIssue)

export const ApiLogSummary = z.object({
  id: ApiLogId,
  connectionId: ConnectionId.nullable(),
  dialect: ApiDialect,
  method: z.string(),
  path: z.string(),
  statusCode: z.number().int(),
  durationMs: z.number().int().min(0),
  errorCode: z.string().nullable(),
  messageIds: z.array(MessageId),
  createdAt: IsoDateTime,
})

export const ApiLogDetail = ApiLogSummary.extend({
  requestHeaders: z.record(z.string(), z.string()), // credentials redacted
  requestBody: z.unknown().nullable(), // attachments stripped, truncated
  responseBody: z.unknown().nullable(), // truncated
  ip: z.string().nullable(),
})

export const ListApiLogsResponse = NumberedPage(ApiLogSummary)

export const SmtpSessionSort = z.enum(['startedAt', '-startedAt'])

export const ListSmtpSessionsQuery = z
  .object({
    connectionId: ConnectionId.optional(),
    outcome: csv(SmtpOutcome).optional(),
    q: z.string().optional(), // substring of remote address, client hostname or AUTH user
    messageId: MessageId.optional(),
    since: IsoDateTime.optional(),
    until: IsoDateTime.optional(),
    sort: SmtpSessionSort.default('-startedAt'),
    ...paging,
  })
  .refine(sinceBeforeUntil, sinceIssue)

export const TranscriptLine = z.object({
  at: z.number(),
  dir: z.enum(['C', 'S']),
  line: z.string(),
})

export const SmtpSessionSummary = z.object({
  id: SmtpSessionId,
  connectionId: ConnectionId.nullable(),
  remoteAddress: z.string(),
  clientHostname: z.string().nullable(),
  authUser: z.string().nullable(),
  secure: z.boolean(),
  outcome: SmtpOutcome,
  error: z.string().nullable(),
  messageIds: z.array(MessageId),
  startedAt: IsoDateTime,
  endedAt: IsoDateTime.nullable(),
})

export const SmtpSessionDetail = SmtpSessionSummary.extend({
  transcript: z.array(TranscriptLine), // capped, AUTH redacted
})

export const ListSmtpSessionsResponse = NumberedPage(SmtpSessionSummary)

export const ApiLogParams = z.object({ id: ApiLogId })
export const SmtpSessionParams = z.object({ id: SmtpSessionId })

export type ApiDialect = z.output<typeof ApiDialect>
export type SmtpOutcome = z.output<typeof SmtpOutcome>
export type ListApiLogsQuery = z.output<typeof ListApiLogsQuery>
export type ApiLogSummary = z.output<typeof ApiLogSummary>
export type ApiLogDetail = z.output<typeof ApiLogDetail>
export type ListApiLogsResponse = z.output<typeof ListApiLogsResponse>
export type ListSmtpSessionsQuery = z.output<typeof ListSmtpSessionsQuery>
export type TranscriptLine = z.output<typeof TranscriptLine>
export type SmtpSessionSummary = z.output<typeof SmtpSessionSummary>
export type SmtpSessionDetail = z.output<typeof SmtpSessionDetail>
export type ListSmtpSessionsResponse = z.output<typeof ListSmtpSessionsResponse>
