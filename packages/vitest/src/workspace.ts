import {
  type CreatedConnection,
  type CreateWorkspaceInput,
  createMailsink,
  isMailsinkError,
  type Mailsink,
  type Workspace,
} from '@devitek/mailsink'

/** Where the Mailsink instance is and how to administrate it. */
export interface MailsinkConnectOptions {
  /** Base URL of the instance, default `MAILSINK_URL`. */
  url?: string
  /** Admin key, default `MAILSINK_ADMIN_KEY`. */
  adminKey?: string
  /** `fetch` implementation, the global one by default. */
  fetch?: typeof fetch
}

export interface EphemeralWorkspaceOptions extends MailsinkConnectOptions {
  /**
   * Fields of the created workspace. `ephemeral` is always true; default name `Tests`,
   * default connections one Resend connection named `Test`.
   */
  workspace?: Partial<CreateWorkspaceInput>
}

/** Serializable part of a workspace handle: what a global setup hands to the tests. */
export interface MailsinkWorkspaceData {
  url: string
  workspace: Workspace
  /** `mskw_` key of the workspace: capture, overrides, stream. */
  workspaceKey: string
  /** Connections with their secrets (API key or SMTP credentials), shown once. */
  connections: CreatedConnection[]
}

export type ConnectionKind = CreatedConnection['kind']
export type Credentials<K extends ConnectionKind = ConnectionKind> = Extract<
  CreatedConnection['credentials'],
  { kind: K }
>

export interface MailsinkWorkspace extends MailsinkWorkspaceData {
  /** SDK client scoped to the workspace (its `mskw_` key). */
  client: Mailsink
  /** Credentials of the first connection of `kind` (any kind when omitted). */
  credentials<K extends ConnectionKind>(kind?: K): Credentials<K>
  /** Deletes the workspace (no-op when it is already gone or was not created here). */
  dispose(): Promise<void>
}

export const DEFAULT_WORKSPACE: Partial<CreateWorkspaceInput> = {
  name: 'Tests',
  connections: [{ kind: 'resend', name: 'Test' }],
}

/** Connection options with the `MAILSINK_URL` and `MAILSINK_ADMIN_KEY` fallbacks. */
export function resolveConnect(options: MailsinkConnectOptions = {}) {
  const env = typeof process === 'undefined' ? {} : process.env
  const url = options.url ?? env.MAILSINK_URL
  const adminKey = options.adminKey ?? env.MAILSINK_ADMIN_KEY
  if (!url) throw new Error('Mailsink: set MAILSINK_URL or pass the `url` option')
  if (!adminKey) throw new Error('Mailsink: set MAILSINK_ADMIN_KEY or pass the `adminKey` option')
  return { url, adminKey, fetch: options.fetch }
}

/** Creates an ephemeral workspace; `dispose()` deletes it. */
export async function createEphemeralWorkspace(
  options: EphemeralWorkspaceOptions = {},
): Promise<MailsinkWorkspace> {
  const { url, adminKey, fetch } = resolveConnect(options)
  const admin = createMailsink({ url, adminKey, fetch })
  const created = await admin.admin.workspaces.create({
    ...DEFAULT_WORKSPACE,
    ...options.workspace,
    name: options.workspace?.name ?? DEFAULT_WORKSPACE.name ?? 'Tests',
    ephemeral: true,
    metadata: { createdBy: '@devitek/mailsink-vitest', ...options.workspace?.metadata },
  })
  const data: MailsinkWorkspaceData = {
    url,
    workspace: created.workspace,
    workspaceKey: created.workspaceKey,
    connections: created.connections,
  }
  return connectWorkspace(data, {
    fetch,
    dispose: async () => {
      try {
        await admin.admin.workspaces.delete(created.workspace.id)
      } catch (error) {
        if (!isMailsinkError(error, 'not_found')) throw error
      }
    },
  })
}

/** A handle on an existing workspace, e.g. the one a global setup created. */
export function connectWorkspace(
  data: MailsinkWorkspaceData,
  options: { fetch?: typeof fetch; dispose?: () => Promise<void> } = {},
): MailsinkWorkspace {
  let disposed: Promise<void> | undefined
  return {
    ...data,
    client: createMailsink({ url: data.url, key: data.workspaceKey, fetch: options.fetch }),
    credentials<K extends ConnectionKind>(kind?: K): Credentials<K> {
      const found = data.connections.find((c) => !kind || c.kind === kind)
      if (!found) throw new Error(`Mailsink: the workspace has no ${kind ?? ''} connection`)
      return found.credentials as Credentials<K>
    },
    dispose() {
      disposed ??= options.dispose?.() ?? Promise.resolve()
      return disposed
    },
  }
}
