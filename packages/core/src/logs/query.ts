import type {
  ApiLogDetail,
  ListApiLogsQuery,
  ListApiLogsResponse,
  ListSmtpSessionsQuery,
  ListSmtpSessionsResponse,
  SmtpSessionDetail,
} from '@mailsink/contracts'
import {
  type Executor,
  findApiLog,
  findSmtpSession,
  listApiLogs,
  listSmtpSessions,
} from '@mailsink/db'
import { DomainError } from '../errors'
import { toApiLogDetail, toApiLogSummary, toSmtpSessionDetail, toSmtpSessionSummary } from './views'

const date = (iso: string | undefined) => (iso ? new Date(iso) : undefined)

/** `GET /capture/logs/api`: one page of the workspace's API calls, with the total. */
export async function listApiLogViews(
  db: Executor,
  workspaceId: string,
  query: ListApiLogsQuery,
): Promise<ListApiLogsResponse> {
  const { rows, total } = await listApiLogs(db, workspaceId, {
    connectionId: query.connectionId,
    dialects: query.dialect,
    statuses: query.status,
    errorCode: query.errorCode,
    method: query.method,
    path: query.path,
    messageId: query.messageId,
    since: date(query.since),
    until: date(query.until),
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  return { data: rows.map(toApiLogSummary), total, page: query.page, pageSize: query.pageSize }
}

/** `GET /capture/logs/api/:id`; another workspace's row is 404 like a missing one. */
export async function getApiLogView(
  db: Executor,
  workspaceId: string,
  id: string,
): Promise<ApiLogDetail> {
  const row = await findApiLog(db, workspaceId, id)
  if (!row) throw new DomainError('not_found', `API log ${id} not found`)
  return toApiLogDetail(row)
}

/** `GET /capture/logs/smtp`: one page of the workspace's SMTP sessions, with the total. */
export async function listSmtpSessionViews(
  db: Executor,
  workspaceId: string,
  query: ListSmtpSessionsQuery,
): Promise<ListSmtpSessionsResponse> {
  const { rows, total } = await listSmtpSessions(db, workspaceId, {
    connectionId: query.connectionId,
    outcomes: query.outcome,
    q: query.q,
    messageId: query.messageId,
    since: date(query.since),
    until: date(query.until),
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  return {
    data: rows.map(toSmtpSessionSummary),
    total,
    page: query.page,
    pageSize: query.pageSize,
  }
}

/** `GET /capture/logs/smtp/:id`, transcript included. */
export async function getSmtpSessionView(
  db: Executor,
  workspaceId: string,
  id: string,
): Promise<SmtpSessionDetail> {
  const row = await findSmtpSession(db, workspaceId, id)
  if (!row) throw new DomainError('not_found', `SMTP session ${id} not found`)
  return toSmtpSessionDetail(row)
}
