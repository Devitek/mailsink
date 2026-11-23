// Direct-insert fixtures shared by the tests of every package: plain rows, no domain logic.
// Domain-shaped fixtures (a captured message, an ingestion target) build on these.
import { randomBytes } from 'node:crypto'
import type { Executor } from '../client'
import { newId } from '../ids'
import { connections, suppressions, workspaces } from '../schema'

type WorkspaceInsert = typeof workspaces.$inferInsert
type ConnectionInsert = typeof connections.$inferInsert

/** A persistent workspace with a unique slug; `patch` overrides any column. */
export async function createTestWorkspace(db: Executor, patch: Partial<WorkspaceInsert> = {}) {
  const [row] = await db
    .insert(workspaces)
    .values({
      id: newId('ws'),
      slug: `test-${randomBytes(6).toString('hex')}`,
      name: 'Test workspace',
      createdVia: 'admin_api',
      ...patch,
    })
    .returning()
  if (!row) throw new Error('workspace not inserted')
  return row
}

/** A Resend connection of `workspaceId`; `patch` overrides any column. */
export async function createTestConnection(
  db: Executor,
  workspaceId: string,
  patch: Partial<ConnectionInsert> = {},
) {
  const [row] = await db
    .insert(connections)
    .values({ id: newId('con'), workspaceId, name: 'Resend', kind: 'resend', ...patch })
    .returning()
  if (!row) throw new Error('connection not inserted')
  return row
}

/** A workspace and one connection, the smallest setup most tests need. */
export async function createTestWorkspaceWithConnection(
  db: Executor,
  patch: { workspace?: Partial<WorkspaceInsert>; connection?: Partial<ConnectionInsert> } = {},
) {
  const workspace = await createTestWorkspace(db, patch.workspace)
  const connection = await createTestConnection(db, workspace.id, patch.connection)
  return { workspace, connection }
}

export async function createTestSuppression(
  db: Executor,
  workspaceId: string,
  email: string,
  reason: (typeof suppressions.$inferInsert)['reason'] = 'hard_bounce',
  messageId: string | null = null,
) {
  const [row] = await db
    .insert(suppressions)
    .values({ id: newId('sup'), workspaceId, email, reason, messageId })
    .returning()
  if (!row) throw new Error('suppression not inserted')
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
