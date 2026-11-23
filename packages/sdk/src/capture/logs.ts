import * as C from '@mailsink/contracts'
import { seg, type Transport } from '../http'
import type { QueryValue } from '../query'
import type {
  ApiLogDetail,
  ApiLogPage,
  ListApiLogsParams,
  ListSmtpSessionsParams,
  SmtpSessionDetail,
  SmtpSessionPage,
} from '../types'

/** API request log of a scope: `/capture/logs/api` (workspace) or `/admin/logs/api`. */
export function apiLogsApi(t: Transport, scope: 'workspace' | 'admin') {
  const base = scope === 'admin' ? '/admin/logs/api' : '/capture/logs/api'
  return {
    list: (params: ListApiLogsParams = {}) =>
      t.json<ApiLogPage>({
        method: 'GET',
        path: base,
        auth: scope,
        query: params as Record<string, QueryValue>,
        schema: C.ListApiLogsResponse,
      }),
    get: (id: string) =>
      t.json<ApiLogDetail>({
        method: 'GET',
        path: `${base}/${seg(id)}`,
        auth: scope,
        schema: C.ApiLogDetail,
      }),
  }
}

/** `/capture/logs/*`: API calls and SMTP sessions (with transcript) of the workspace. */
export function logsApi(t: Transport) {
  return {
    api: apiLogsApi(t, 'workspace'),
    smtp: {
      list: (params: ListSmtpSessionsParams = {}) =>
        t.json<SmtpSessionPage>({
          method: 'GET',
          path: '/capture/logs/smtp',
          auth: 'workspace',
          query: params as Record<string, QueryValue>,
          schema: C.ListSmtpSessionsResponse,
        }),
      get: (id: string) =>
        t.json<SmtpSessionDetail>({
          method: 'GET',
          path: `/capture/logs/smtp/${seg(id)}`,
          auth: 'workspace',
          schema: C.SmtpSessionDetail,
        }),
    },
  }
}

export type LogsApi = ReturnType<typeof logsApi>
