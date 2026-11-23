import {
  ApiLogDetail,
  ApiLogParams,
  ListApiLogsQuery,
  ListApiLogsResponse,
  ListSmtpSessionsQuery,
  ListSmtpSessionsResponse,
  SmtpSessionDetail,
  SmtpSessionParams,
} from '@mailsink/contracts'
import type { RouteSpec } from '../route'

const capture = { tag: 'Capture: logs', auth: 'workspace' } as const

/** Request log and SMTP sessions (#35): workspace side, and the Admin view (D151). */
export const LOG_ROUTES: RouteSpec[] = [
  {
    ...capture,
    operationId: 'listApiLogs',
    method: 'get',
    path: '/capture/logs/api',
    summary: 'API request log of the workspace',
    query: ListApiLogsQuery,
    success: [{ status: 200, description: 'One page.', schema: ListApiLogsResponse }],
  },
  {
    ...capture,
    operationId: 'getApiLog',
    method: 'get',
    path: '/capture/logs/api/{id}',
    summary: 'One logged request, headers and bodies',
    params: ApiLogParams,
    success: [{ status: 200, description: 'The request.', schema: ApiLogDetail }],
  },
  {
    ...capture,
    operationId: 'listSmtpSessions',
    method: 'get',
    path: '/capture/logs/smtp',
    summary: 'SMTP sessions of the workspace',
    query: ListSmtpSessionsQuery,
    success: [{ status: 200, description: 'One page.', schema: ListSmtpSessionsResponse }],
  },
  {
    ...capture,
    operationId: 'getSmtpSession',
    method: 'get',
    path: '/capture/logs/smtp/{id}',
    summary: 'One SMTP session with its transcript',
    params: SmtpSessionParams,
    success: [{ status: 200, description: 'The session.', schema: SmtpSessionDetail }],
  },
  {
    tag: 'Admin',
    auth: 'admin',
    operationId: 'listAdminApiLogs',
    method: 'get',
    path: '/admin/logs/api',
    summary: 'API log rows without workspace (failed authentication, Admin calls)',
    query: ListApiLogsQuery,
    success: [{ status: 200, description: 'One page.', schema: ListApiLogsResponse }],
  },
  {
    tag: 'Admin',
    auth: 'admin',
    operationId: 'getAdminApiLog',
    method: 'get',
    path: '/admin/logs/api/{id}',
    summary: 'One API log row without workspace',
    params: ApiLogParams,
    success: [{ status: 200, description: 'The request.', schema: ApiLogDetail }],
  },
]
