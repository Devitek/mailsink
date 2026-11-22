import { keyKind } from '@mailsink/contracts'
import { DomainError, hashApiKey, secretsEqual } from '@mailsink/core'
import {
  type ApiKey,
  type Connection,
  type Database,
  findActiveApiKeyByHash,
  findWorkspaceByRef,
  type Workspace,
} from '@mailsink/db'

export const WORKSPACE_HEADER = 'X-Mailsink-Workspace'

/**
 * - `none`: public route (`/healthz`).
 * - `admin`: Admin key only (`/admin/…`).
 * - `workspace`: any active key of the workspace, `msk_` or `mskw_`, or the Admin key with
 *   `X-Mailsink-Workspace` (D12): Capture and MCP.
 * - `connection`: a connection key `msk_` only: ingestion (native and dialects).
 */
export type AuthMode = 'none' | 'admin' | 'workspace' | 'connection'

export type AdminAuth = { kind: 'admin' }
export type WorkspaceAuth = {
  kind: 'workspace'
  via: 'admin_key' | 'workspace_key' | 'connection_key'
  workspace: Workspace
  connection: Connection | null
  apiKey: ApiKey | null
}
export type ConnectionAuth = WorkspaceAuth & {
  via: 'connection_key'
  connection: Connection
  apiKey: ApiKey
}
export type AuthFor<M extends AuthMode> = M extends 'admin'
  ? AdminAuth
  : M extends 'workspace'
    ? WorkspaceAuth
    : M extends 'connection'
      ? ConnectionAuth
      : null

export interface AuthDeps {
  db: Database
  adminKey: string | undefined
}

const unauthorized = (message = 'Missing or invalid API key') =>
  new DomainError('unauthorized', message, { headers: { 'WWW-Authenticate': 'Bearer' } })

/** `Authorization: Bearer <key>`, else the Brevo `api-key` header. */
export function readCredential(request: Request): string | undefined {
  const authorization = request.headers.get('authorization')
  const bearer = authorization?.match(/^Bearer\s+(\S+)\s*$/i)?.[1]
  return bearer ?? (request.headers.get('api-key')?.trim() || undefined)
}

export async function authenticate<M extends AuthMode>(
  request: Request,
  mode: M,
  deps: AuthDeps,
): Promise<AuthFor<M>> {
  return (await resolve(request, mode, deps)) as AuthFor<M>
}

async function resolve(request: Request, mode: AuthMode, deps: AuthDeps) {
  if (mode === 'none') return null
  const token = readCredential(request)
  if (!token) throw unauthorized()
  const wanted = request.headers.get(WORKSPACE_HEADER)?.trim() || undefined

  if (deps.adminKey && secretsEqual(token, deps.adminKey)) {
    if (mode === 'admin') return { kind: 'admin' } satisfies AdminAuth
    if (mode === 'connection') {
      throw new DomainError('forbidden', 'This route needs a connection key (msk_)')
    }
    if (!wanted) {
      throw new DomainError(
        'validation_error',
        `${WORKSPACE_HEADER} is required with the admin key`,
        {
          status: 400,
        },
      )
    }
    const workspace = await findWorkspaceByRef(deps.db, wanted)
    if (!workspace) throw new DomainError('not_found', 'Workspace not found')
    return { kind: 'workspace', via: 'admin_key', workspace, connection: null, apiKey: null }
  }
  if (mode === 'admin') throw unauthorized('Missing or invalid admin key')

  const kind = keyKind(token)
  if (!kind) throw unauthorized()
  const found = await findActiveApiKeyByHash(deps.db, hashApiKey(token))
  if (!found || found.key.scope !== kind) throw unauthorized()

  const { key, workspace, connection } = found
  if (wanted && wanted !== workspace.id && wanted !== workspace.slug) {
    throw new DomainError('forbidden', 'This key does not belong to the requested workspace')
  }
  if (mode === 'connection' && !connection) {
    throw new DomainError('forbidden', 'This route needs a connection key (msk_)')
  }
  if (connection?.disabledAt) throw new DomainError('forbidden', 'This connection is disabled')
  return {
    kind: 'workspace',
    via: connection ? 'connection_key' : 'workspace_key',
    workspace,
    connection,
    apiKey: key,
  }
}
