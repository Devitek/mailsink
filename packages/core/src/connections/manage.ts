import type {
  ConnectionInput,
  ConnectionView,
  CreatedConnection,
  UpdateConnectionRequest,
} from '@mailsink/contracts'
import {
  activeKeyPrefixes,
  type Connection,
  type Database,
  deleteConnection,
  findConnection,
  findWorkspaceByRef,
  insertApiKeys,
  insertConnections,
  newId,
  revokeConnectionKeys,
  updateConnection,
  type Workspace,
} from '@mailsink/db'
import { DomainError } from '../errors'
import { toConnectionView } from '../workspaces/views'
import { generateKey, generateSmtpPassword, hashSmtpPassword } from './credentials'
import { planConnection, rethrowConflict } from './plan'
import {
  buildCredentials,
  type CredentialSecrets,
  envSnippet,
  type PublicEndpoints,
} from './snippets'

// Connections of an existing workspace (#38): add, rename, disable, rotate, delete. The
// workspace is named by id or slug; a connection of another workspace is not found.

export interface ManageOptions {
  endpoints: PublicEndpoints
  now?: Date
}

const connectionNotFound = () => new DomainError('not_found', 'Connection not found')

async function workspaceOf(db: Database, ref: string): Promise<Workspace> {
  const workspace = await findWorkspaceByRef(db, ref)
  if (!workspace) throw new DomainError('not_found', 'Workspace not found')
  return workspace
}

async function connectionOf(db: Database, ref: string, id: string) {
  const workspace = await workspaceOf(db, ref)
  const connection = await findConnection(db, workspace.id, id)
  if (!connection) throw connectionNotFound()
  return { workspace, connection }
}

function withSecrets(
  row: Connection,
  secrets: CredentialSecrets,
  displayPrefix: string | undefined,
  endpoints: PublicEndpoints,
): CreatedConnection {
  const credentials = buildCredentials(secrets, endpoints)
  return {
    ...toConnectionView(row, displayPrefix),
    credentials,
    envSnippet: envSnippet(credentials),
  }
}

/** Creates one connection and its credentials in one transaction; secrets answered once. */
export async function addConnection(
  db: Database,
  ref: string,
  input: ConnectionInput,
  options: ManageOptions,
): Promise<CreatedConnection> {
  const workspace = await workspaceOf(db, ref)
  const plan = await planConnection(input, workspace.id, workspace.slug)
  const row = await db
    .transaction(async (tx) => {
      const [inserted] = await insertConnections(tx, [plan.row])
      await insertApiKeys(tx, plan.key ? [plan.key] : [])
      return inserted as Connection
    })
    .catch(rethrowConflict)
  return withSecrets(row, plan.secrets, plan.key?.displayPrefix, options.endpoints)
}

/**
 * New secret, old one unusable at once: `resend` / `brevo` get a new `msk_` key and every
 * previous key of the connection is revoked; `smtp` gets a new password (same username).
 */
export async function rotateConnectionCredentials(
  db: Database,
  ref: string,
  id: string,
  options: ManageOptions,
): Promise<CreatedConnection> {
  const now = options.now ?? new Date()
  const { workspace, connection } = await connectionOf(db, ref, id)
  if (connection.kind === 'smtp') {
    const smtpPass = generateSmtpPassword()
    const smtpPasswordHash = await hashSmtpPassword(smtpPass)
    const row = await updateConnection(db, workspace.id, id, { smtpPasswordHash }, now)
    if (!row?.smtpUsername) throw connectionNotFound()
    const secrets = { kind: 'smtp' as const, smtpUser: row.smtpUsername, smtpPass }
    return withSecrets(row, secrets, undefined, options.endpoints)
  }
  const key = generateKey('connection')
  const row = await db.transaction(async (tx) => {
    await revokeConnectionKeys(tx, id, now)
    await insertApiKeys(tx, [
      {
        id: newId('key'),
        workspaceId: workspace.id,
        connectionId: id,
        scope: 'connection',
        displayPrefix: key.displayPrefix,
        hash: key.hash,
        createdAt: now,
      },
    ])
    return updateConnection(tx, workspace.id, id, {}, now)
  })
  if (!row) throw connectionNotFound()
  const secrets = { kind: connection.kind, apiKey: key.key }
  return withSecrets(row, secrets, key.displayPrefix, options.endpoints)
}

/** Renames and / or disables (`disabledAt` = now) or enables a connection. */
export async function updateConnectionSettings(
  db: Database,
  ref: string,
  id: string,
  patch: UpdateConnectionRequest,
  options: { now?: Date } = {},
): Promise<ConnectionView> {
  const now = options.now ?? new Date()
  const { workspace, connection } = await connectionOf(db, ref, id)
  const disabledAt =
    patch.enabled === undefined
      ? connection.disabledAt
      : patch.enabled
        ? null
        : (connection.disabledAt ?? now)
  const row = await updateConnection(
    db,
    workspace.id,
    id,
    { name: patch.name ?? connection.name, disabledAt },
    now,
  )
  if (!row) throw connectionNotFound()
  const prefixes = await activeKeyPrefixes(db, workspace.id)
  return toConnectionView(row, prefixes.get(id))
}

/** Hard delete: keys, webhook endpoints and overrides of the connection go with it. */
export async function removeConnection(db: Database, ref: string, id: string): Promise<void> {
  const workspace = await workspaceOf(db, ref)
  if (!(await deleteConnection(db, workspace.id, id))) throw connectionNotFound()
}
