import type { EventBus } from '@mailsink/core'
import type { Database, Workspace } from '@mailsink/db'

/**
 * What every tool runs against: the authenticated workspace (D12) and the shared runtime
 * services. The HTTP route builds one per request after `defineApi()` authenticated it, so
 * a tool never sees another workspace.
 */
export interface McpContext {
  db: Database
  bus: EventBus
  workspace: Workspace
  /** `MAILSINK_PUBLIC_URL` (no trailing slash): base of the URLs tools return (D35). */
  publicUrl: string
}
