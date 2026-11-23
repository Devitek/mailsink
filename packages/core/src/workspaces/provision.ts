import type { CreateWorkspaceRequest, CreateWorkspaceResponse } from '@mailsink/contracts'
import {
  type Database,
  insertApiKeys,
  insertConnections,
  insertWorkspace,
  type NewApiKey,
  type NewConnection,
  newId,
} from '@mailsink/db'
import {
  generateKey,
  generateSmtpPassword,
  generateSmtpUsername,
  hashSmtpPassword,
} from '../connections/credentials'
import {
  buildCredentials,
  type CredentialSecrets,
  envSnippet,
  type PublicEndpoints,
} from '../connections/snippets'
import { DomainError } from '../errors'
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

type Planned = { row: NewConnection; secrets: CredentialSecrets; key?: NewApiKey }

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
      const plan = planned[i] as Planned
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
): Promise<Planned[]> {
  const usernames = new Set<string>()
  const planned: Planned[] = []
  for (const connection of input.connections) {
    const id = newId('con')
    const row: NewConnection = {
      id,
      workspaceId,
      name: connection.name,
      kind: connection.kind,
      retentionSeconds: connection.retention ?? null,
      rateLimit: connection.rateLimit ?? null,
      simulation: connection.simulation ?? null,
    }
    if (connection.kind === 'smtp') {
      const smtpUser = connection.smtpUsername ?? generateSmtpUsername(slug)
      if (usernames.has(smtpUser)) throw smtpUsernameTaken()
      usernames.add(smtpUser)
      const smtpPass = generateSmtpPassword()
      row.smtpUsername = smtpUser
      row.smtpPasswordHash = await hashSmtpPassword(smtpPass)
      planned.push({ row, secrets: { kind: 'smtp', smtpUser, smtpPass } })
      continue
    }
    const key = generateKey('connection')
    planned.push({
      row,
      secrets: { kind: connection.kind, apiKey: key.key },
      key: {
        id: newId('key'),
        workspaceId,
        connectionId: id,
        scope: 'connection',
        displayPrefix: key.displayPrefix,
        hash: key.hash,
      },
    })
  }
  return planned
}

const smtpUsernameTaken = () => new DomainError('conflict', 'This SMTP username is already taken')

/** Maps the unique violations a caller can cause (slug, SMTP username) to 409 `conflict`. */
function rethrowConflict(error: unknown): never {
  const constraint = uniqueViolation(error)
  if (constraint === 'workspaces_slug_unique') {
    throw new DomainError('conflict', 'This workspace slug is already taken')
  }
  if (constraint === 'connections_smtp_username_unique') throw smtpUsernameTaken()
  throw error
}

/** Constraint name of a Postgres unique violation (23505); drivers nest it in `cause`. */
function uniqueViolation(error: unknown): string | undefined {
  let current: unknown = error
  while (current && typeof current === 'object') {
    if ('code' in current && current.code === '23505') {
      return 'constraint' in current ? String(current.constraint) : undefined
    }
    current = 'cause' in current ? current.cause : undefined
  }
  return undefined
}
