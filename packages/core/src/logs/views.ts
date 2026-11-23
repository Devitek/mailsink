import type {
  ApiLogDetail,
  ApiLogSummary,
  SmtpSessionDetail,
  SmtpSessionSummary,
} from '@mailsink/contracts'
import type { ApiLog, SmtpSession } from '@mailsink/db'

export function toApiLogSummary(row: ApiLog): ApiLogSummary {
  return {
    id: row.id,
    connectionId: row.connectionId,
    dialect: row.dialect,
    method: row.method,
    path: row.path,
    statusCode: row.statusCode,
    durationMs: row.durationMs,
    errorCode: row.errorCode,
    messageIds: row.messageIds ?? [],
    createdAt: row.createdAt.toISOString(),
  }
}

export function toApiLogDetail(row: ApiLog): ApiLogDetail {
  return {
    ...toApiLogSummary(row),
    requestHeaders: row.requestHeaders ?? {},
    requestBody: row.requestBody ?? null,
    responseHeaders: row.responseHeaders ?? {},
    responseBody: row.responseBody ?? null,
    ip: row.ip,
  }
}

export function toSmtpSessionSummary(row: SmtpSession): SmtpSessionSummary {
  return {
    id: row.id,
    connectionId: row.connectionId,
    remoteAddress: row.remoteAddress,
    clientHostname: row.clientHostname,
    authUser: row.authUser,
    secure: row.secure,
    outcome: row.outcome,
    error: row.error,
    messageIds: row.messageIds ?? [],
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
  }
}

export function toSmtpSessionDetail(row: SmtpSession): SmtpSessionDetail {
  return { ...toSmtpSessionSummary(row), transcript: row.transcript }
}
