import type { CreateWorkspaceRequest, CreateWorkspaceResponse } from '@mailsink/contracts'
import {
  type Database,
  insertApiKeys,
  insertConnections,
  insertWorkspace,
  newId,
} from '@mailsink/db'
import { generateKey } from '../connections/credentials'
import {
  type PlannedConnection,
  planConnection,
  rethrowConflict,
  smtpUsernameTaken,
} from '../connections/plan'
import { buildCredentials, envSnippet, type PublicEndpoints } from '../connections/snippets'
import { insertTemplateInputs } from '../templates/service'
import { generateSlug } from './slug'
import { toConnectionView, toWorkspaceView } from './views'

export interface ProvisionOptions {
  endpoints: PublicEndpoints
  /** `MAILSINK_DEFAULT_IDLE_TTL`, applied when an ephemeral workspace omits idleTtlSeconds. */
  defaultIdleTtlSeconds: number
  createdVia?: 'ui' | 'admin_api'
  now?: Date
}

/**
 * Creates a workspace, its connections and their credentials in one transaction (#13).
 * Secrets (keys, SMTP passwords) only exist in the returned value: the database keeps
 * SHA-256 hashes for keys and scrypt hashes for SMTP passwords (D11).
 */
export async function createWorkspace(
  db: Database,
  input: CreateWorkspaceRequest,
  options: ProvisionOptions,
): Promise<CreateWorkspaceResponse> {
  const now = options.now ?? new Date()
  const workspaceId = newId('ws', now.getTime())
  const slug = input.slug ?? generateSlug(input.name)
  const idleTtlSeconds = input.ephemeral
    ? (input.idleTtlSeconds ?? options.defaultIdleTtlSeconds)
    : null
  const planned = await planConnections(input, workspaceId, slug)
  const workspaceKey = generateKey('workspace')

  const created = await db
    .transaction(async (tx) => {
      const workspace = await insertWorkspace(tx, {
        id: workspaceId,
        slug,
        name: input.name,
        description: input.description ?? null,
        ephemeral: input.ephemeral,
        idleTtlSeconds,
        lastActivityAt: now,
        expiresAt: idleTtlSeconds === null ? null : new Date(now.getTime() + idleTtlSeconds * 1000),
        retentionSeconds: input.retention,
        maxMessages: input.maxMessages ?? null,
        rateLimit: input.rateLimit ?? null,
        simulation: input.simulation, // undefined: column default (contract defaults)
        metadata: input.metadata ?? null,
        createdVia: options.createdVia ?? 'admin_api',
        createdAt: now,
        updatedAt: now,
      })
      const connections = await insertConnections(
        tx,
        planned.map((p) => p.row),
      )
      await insertApiKeys(tx, [
        ...planned.flatMap((p) => (p.key ? [p.key] : [])),
        {
          id: newId('key'),
          workspaceId,
          scope: 'workspace',
          displayPrefix: workspaceKey.displayPrefix,
          hash: workspaceKey.hash,
        },
      ])
      await insertTemplateInputs(tx, workspaceId, input.templates ?? [], now) // #30
      return { workspace, connections }
    })
    .catch(rethrowConflict)

  return {
    workspace: toWorkspaceView(created.workspace, options.endpoints.publicUrl),
    workspaceKey: workspaceKey.key,
    connections: created.connections.map((row, i) => {
      const plan = planned[i] as PlannedConnection
      const credentials = buildCredentials(plan.secrets, options.endpoints)
      return {
        ...toConnectionView(row, plan.key?.displayPrefix),
        credentials,
        envSnippet: envSnippet(credentials),
      }
    }),
  }
}

async function planConnections(
  input: CreateWorkspaceRequest,
  workspaceId: string,
  slug: string,
): Promise<PlannedConnection[]> {
  const usernames = new Set<string>()
  const planned: PlannedConnection[] = []
  for (const connection of input.connections) {
    const plan = await planConnection(connection, workspaceId, slug)
    const smtpUser = plan.row.smtpUsername
    if (smtpUser) {
      if (usernames.has(smtpUser)) throw smtpUsernameTaken()
      usernames.add(smtpUser)
    }
    planned.push(plan)
  }
  return planned
}
