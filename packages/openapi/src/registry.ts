import type { HttpMethod, RouteSpec } from './route'
import { ADMIN_ROUTES } from './routes/admin'
import { BREVO_READ_ROUTES } from './routes/brevo-read'
import { CAPTURE_ROUTES } from './routes/capture'
import { INGESTION_ROUTES } from './routes/ingestion'
import { LOG_ROUTES } from './routes/logs'
import { SYSTEM_ROUTES } from './routes/system'
import { TEMPLATE_ROUTES } from './routes/templates'
import { WEBHOOK_ROUTES } from './routes/webhooks'

/** Every documented server route: the single registry the document is built from. */
export const ROUTES: readonly RouteSpec[] = [
  ...INGESTION_ROUTES,
  ...BREVO_READ_ROUTES,
  ...ADMIN_ROUTES,
  ...TEMPLATE_ROUTES,
  ...CAPTURE_ROUTES,
  ...WEBHOOK_ROUTES,
  ...LOG_ROUTES,
  ...SYSTEM_ROUTES,
]

export interface UndocumentedRoute {
  method: HttpMethod
  /** OpenAPI form, like `RouteSpec.path`. */
  path: string
  reason: string
}

const UI_SESSION = 'Web UI only: session cookie of the signed-in browser, not a public API.'
const MCP = 'MCP Streamable HTTP (JSON-RPC), described by MCP itself: docs/guides/mcp.md.'

/**
 * Server routes deliberately left out of the document (D232). The coverage
 * test fails on a route that is in neither list, and on an entry here that no longer exists.
 */
export const UNDOCUMENTED_ROUTES: readonly UndocumentedRoute[] = [
  { method: 'post', path: '/mcp', reason: MCP },
  { method: 'get', path: '/mcp', reason: MCP },
  { method: 'delete', path: '/mcp', reason: MCP },
  { method: 'post', path: '/login', reason: UI_SESSION },
  { method: 'get', path: '/w/{workspaceSlug}/m/stream', reason: UI_SESSION },
  { method: 'get', path: '/w/{workspaceSlug}/m/{messageId}/html', reason: UI_SESSION },
  { method: 'get', path: '/w/{workspaceSlug}/m/{messageId}/raw', reason: UI_SESSION },
  {
    method: 'get',
    path: '/w/{workspaceSlug}/m/{messageId}/attachments/{attachmentId}',
    reason: UI_SESSION,
  },
]
