import type { ConnectionInput } from '@mailsink/contracts'
import { type NewApiKey, type NewConnection, newId } from '@mailsink/db'
import { DomainError } from '../errors'
import {
  generateKey,
  generateSmtpPassword,
  generateSmtpUsername,
  hashSmtpPassword,
} from './credentials'
import type { CredentialSecrets } from './snippets'

/** A connection row ready to insert, its secrets (shown once) and its `msk_` key row. */
export type PlannedConnection = { row: NewConnection; secrets: CredentialSecrets; key?: NewApiKey }

/**
 * Generates the credentials of a new connection (#13, #38): an `msk_` key for `resend` and
 * `brevo`, an SMTP username (given or `<slug>-<8 hex>`) and password for `smtp`.
 */
export async function planConnection(
  connection: ConnectionInput,
  workspaceId: string,
  slug: string,
): Promise<PlannedConnection> {
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
    const smtpPass = generateSmtpPassword()
    row.smtpUsername = smtpUser
    row.smtpPasswordHash = await hashSmtpPassword(smtpPass)
    return { row, secrets: { kind: 'smtp', smtpUser, smtpPass } }
  }
  const key = generateKey('connection')
  return {
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
  }
}

export const smtpUsernameTaken = () =>
  new DomainError('conflict', 'This SMTP username is already taken')

/** Maps the unique violations a caller can cause (slug, SMTP username) to 409 `conflict`. */
export function rethrowConflict(error: unknown): never {
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
