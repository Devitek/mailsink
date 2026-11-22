import type { Executor } from '../src/client'
import { newId } from '../src/ids'
import { connections, messages, workspaces } from '../src/schema'

export async function insertWorkspace(
  db: Executor,
  patch: Partial<typeof workspaces.$inferInsert> = {},
) {
  const id = newId('ws')
  const [row] = await db
    .insert(workspaces)
    .values({ id, slug: id, name: 'Test workspace', createdVia: 'admin_api', ...patch })
    .returning()
  if (!row) throw new Error('workspace not inserted')
  return row
}

export async function insertConnection(
  db: Executor,
  workspaceId: string,
  patch: Partial<typeof connections.$inferInsert> = {},
) {
  const [row] = await db
    .insert(connections)
    .values({ id: newId('con'), workspaceId, name: 'Resend', kind: 'resend', ...patch })
    .returning()
  if (!row) throw new Error('connection not inserted')
  return row
}

export async function insertMessage(
  db: Executor,
  workspaceId: string,
  connectionId?: string,
  rawBlobId?: string,
) {
  const id = newId('msg')
  const [row] = await db
    .insert(messages)
    .values({
      id,
      workspaceId,
      connectionId,
      source: 'native',
      providerMessageId: id,
      from: { email: 'app@example.com' },
      sizeBytes: 42,
      rawBlobId,
    })
    .returning()
  if (!row) throw new Error('message not inserted')
  return row
}

/** Postgres error code of a rejected statement (drizzle wraps driver errors in `cause`). */
export function pgCode(error: unknown): string | undefined {
  let current: unknown = error
  while (current && typeof current === 'object') {
    if ('code' in current && typeof current.code === 'string') return current.code
    current = 'cause' in current ? current.cause : undefined
  }
  return undefined
}
