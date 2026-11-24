import {
  type CreatedConnection,
  createMailsink,
  isMailsinkError,
  type Mailsink,
} from '@devitek/mailsink'
import type { ResolvedWorkspaceOptions } from './options'

/** The ephemeral workspace of one Playwright worker (fixture `mailsinkWorkspace`). */
export interface MailsinkWorkspace {
  id: string
  slug: string
  /** Base URL of the Mailsink server. */
  url: string
  /** `mskw_` key: Capture API (assertions, overrides, reset). */
  workspaceKey: string
  /** Every connection with its credentials, in the order of the options. */
  connections: CreatedConnection[]
  /** First connection whose name or kind matches; throws when none does. */
  connection(nameOrKind?: string): CreatedConnection
  /**
   * `.env` variables of the connections for the application under test
   * (`RESEND_API_KEY`, `RESEND_BASE_URL`, `SMTP_HOST`...). On a name clash, the first
   * connection wins.
   */
  env: Record<string, string>
  /** SDK client scoped to the workspace (workspace key). */
  client: Mailsink
  /** SDK client with the admin key, for Admin API calls. */
  admin: Mailsink
}

export interface ProvisionedWorkspace extends MailsinkWorkspace {
  /** Deletes the workspace; a workspace already gone is fine. */
  dispose(): Promise<void>
}

/** `POST /admin/workspaces`: an ephemeral workspace with its connections. */
export async function provisionWorkspace(
  options: ResolvedWorkspaceOptions,
  fetchImpl?: typeof fetch,
): Promise<ProvisionedWorkspace> {
  const admin = createMailsink({
    url: options.url,
    adminKey: options.adminKey,
    validate: options.validate,
    fetch: fetchImpl,
  })
  const created = await admin.admin.workspaces.create(options.input)
  const { workspace, connections } = created
  return {
    id: workspace.id,
    slug: workspace.slug,
    url: options.url,
    workspaceKey: created.workspaceKey,
    connections,
    connection: (nameOrKind) => pickConnection(connections, nameOrKind),
    env: connectionsEnv(connections),
    client: admin.with({ key: created.workspaceKey, adminKey: undefined }),
    admin,
    dispose: () => deleteWorkspace(admin, workspace.id),
  }
}

/**
 * `DELETE /admin/workspaces/:id`, retried once on a network error (an idle keep-alive
 * socket closed by the server, #118): the call is idempotent and 404 counts as done.
 */
export async function deleteWorkspace(admin: Mailsink, id: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await admin.admin.workspaces.delete(id)
      return
    } catch (error) {
      if (isMailsinkError(error, 'not_found')) return
      if (!isMailsinkError(error, 'network_error') || attempt >= 3) throw error
    }
  }
}

export function pickConnection(
  connections: readonly CreatedConnection[],
  nameOrKind?: string,
): CreatedConnection {
  const found =
    nameOrKind === undefined
      ? connections[0]
      : (connections.find((c) => c.name === nameOrKind) ??
        connections.find((c) => c.kind === nameOrKind))
  if (found) return found
  const known = connections.map((c) => `${c.name} (${c.kind})`).join(', ') || 'none'
  throw new Error(`Mailsink: no connection "${nameOrKind ?? ''}" in the workspace (${known})`)
}

/** Merges the `.env` snippets of the connections, the first one winning on a clash. */
export function connectionsEnv(connections: readonly { envSnippet: string }[]) {
  const env: Record<string, string> = {}
  for (const { envSnippet } of connections) {
    for (const [name, value] of Object.entries(parseEnvSnippet(envSnippet))) {
      if (!(name in env)) env[name] = value
    }
  }
  return env
}

/** `NAME=value` lines (comments and blank lines skipped). */
export function parseEnvSnippet(snippet: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of snippet.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line)
    if (match?.[1]) env[match[1]] = (match[2] ?? '').trim()
  }
  return env
}
