import { verifySmtpPassword } from '@mailsink/core'
import { connections, type Executor } from '@mailsink/db'
import { and, eq } from 'drizzle-orm'
import type { CredentialCache } from './credential-cache'

/** The authenticated principal of an SMTP session (`session.user`). */
export interface SmtpUser {
  username: string
  connectionId: string
  workspaceId: string
}

/** Stand-in hash verified for unknown usernames, so they cost one scrypt too. */
const DECOY_HASH =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

/**
 * `AUTH PLAIN/LOGIN` (03-contracts « SMTP mapping »): the username designates an `smtp`
 * connection, the password is checked with scrypt (D11) unless the cache verified the same
 * one against the same stored hash. Null for an unknown username, a wrong password or a
 * disabled connection: the client gets the same `535` either way.
 */
export async function authenticate(
  db: Executor,
  cache: CredentialCache,
  username: string,
  password: string,
): Promise<SmtpUser | null> {
  const [row] = await db
    .select({
      id: connections.id,
      workspaceId: connections.workspaceId,
      hash: connections.smtpPasswordHash,
      disabledAt: connections.disabledAt,
    })
    .from(connections)
    .where(and(eq(connections.smtpUsername, username), eq(connections.kind, 'smtp')))
    .limit(1)
  if (!row?.hash) {
    await verifySmtpPassword(password, DECOY_HASH)
    return null
  }
  const valid =
    cache.has(row.id, row.hash, password) || (await verifySmtpPassword(password, row.hash))
  if (!valid) return null
  cache.remember(row.id, row.hash, password)
  if (row.disabledAt) return null
  return { username, connectionId: row.id, workspaceId: row.workspaceId }
}
