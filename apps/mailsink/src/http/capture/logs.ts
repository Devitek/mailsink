// Log read API (03-contracts, « Logs », #35): workspace scope auth (D12, D41), for the UI
// DataTables and MCP. Reading the logs is itself not logged (D145).
import {
  ApiLogParams,
  ListApiLogsQuery,
  ListSmtpSessionsQuery,
  SmtpSessionParams,
} from '@mailsink/contracts'
import {
  getApiLogView,
  getSmtpSessionView,
  listApiLogViews,
  listSmtpSessionViews,
} from '@mailsink/core'
import { defineApi } from '../handler'

/** GET /capture/logs/api: filters, sort and page-number pagination with the total. */
export const listApiLogsApi = defineApi({
  auth: 'workspace',
  query: ListApiLogsQuery,
  handler: ({ runtime, auth, query }) => listApiLogViews(runtime.db.db, auth.workspace.id, query),
})

/** GET /capture/logs/api/:id: headers (redacted) and bodies (stripped, truncated). */
export const getApiLogApi = defineApi({
  auth: 'workspace',
  params: ApiLogParams,
  handler: ({ runtime, auth, params }) =>
    getApiLogView(runtime.db.db, auth.workspace.id, params.id),
})

/** GET /capture/logs/smtp: filters, sort and page-number pagination with the total. */
export const listSmtpSessionsApi = defineApi({
  auth: 'workspace',
  query: ListSmtpSessionsQuery,
  handler: ({ runtime, auth, query }) =>
    listSmtpSessionViews(runtime.db.db, auth.workspace.id, query),
})

/** GET /capture/logs/smtp/:id: the session with its capped, AUTH-redacted transcript. */
export const getSmtpSessionApi = defineApi({
  auth: 'workspace',
  params: SmtpSessionParams,
  handler: ({ runtime, auth, params }) =>
    getSmtpSessionView(runtime.db.db, auth.workspace.id, params.id),
})
