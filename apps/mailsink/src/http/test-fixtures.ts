// Test-only helpers for the HTTP layer (imported by *.test.ts files only).
import { randomBytes } from 'node:crypto'
import { hashApiKey } from '@mailsink/core'
import { apiKeys, connections, type Database, type DbHandle, newId, workspaces } from '@mailsink/db'
import { bootRuntime } from '../runtime/boot'
import type { RuntimeConfig } from '../runtime/config'
import type { Runtime } from '../runtime/container'

export const ADMIN_KEY = 'test-admin-key-0123456789'

/** Puts a runtime around the test database in the globalThis slot, as the Nitro plugin does. */
export function installTestRuntime(db: DbHandle, config: Partial<RuntimeConfig> = {}) {
  const runtime: Runtime = {
    config: {
      databaseUrl: 'pglite://memory',
      adminKey: ADMIN_KEY,
      smtpHost: '127.0.0.1',
      smtpPort: 0,
      workerIntervalMs: 1000,
      maxMessageBytes: 26_214_400,
      publicUrl: 'http://mailsink.test',
      defaultIdleTtlSeconds: 3600,
      ...config,
    },
    db,
    smtpPort: 0,
    stop: async () => {},
  }
  const silent = { info: () => {}, warn: () => {}, error: () => {} }
  return bootRuntime({ start: async () => runtime, log: silent, shutdownHooks: false })
}

const token = (prefix: string) => `${prefix}${randomBytes(18).toString('base64url')}`

/** A workspace with one connection, its `msk_` key and a `mskw_` workspace key. */
export async function seedWorkspace(db: Database, options: { disabled?: boolean } = {}) {
  const suffix = randomBytes(4).toString('hex')
  const [workspace] = await db
    .insert(workspaces)
    .values({ id: newId('ws'), slug: `team-${suffix}`, name: 'Team', createdVia: 'admin_api' })
    .returning()
  if (!workspace) throw new Error('workspace not inserted')
  const [connection] = await db
    .insert(connections)
    .values({
      id: newId('con'),
      workspaceId: workspace.id,
      name: 'Resend',
      kind: 'resend',
      disabledAt: options.disabled ? new Date() : null,
    })
    .returning()
  if (!connection) throw new Error('connection not inserted')
  const connectionKey = token('msk_')
  const workspaceKey = token('mskw_')
  const revokedKey = token('msk_')
  const base = { workspaceId: workspace.id, displayPrefix: 'msk_test' }
  await db.insert(apiKeys).values([
    {
      ...base,
      id: newId('key'),
      connectionId: connection.id,
      scope: 'connection',
      hash: hashApiKey(connectionKey),
    },
    { ...base, id: newId('key'), scope: 'workspace', hash: hashApiKey(workspaceKey) },
    {
      ...base,
      id: newId('key'),
      connectionId: connection.id,
      scope: 'connection',
      hash: hashApiKey(revokedKey),
      revokedAt: new Date(),
    },
  ])
  return { workspace, connection, connectionKey, workspaceKey, revokedKey }
}

export function request(path: string, init: RequestInit & { bearer?: string } = {}): Request {
  const headers = new Headers(init.headers)
  if (init.bearer) headers.set('authorization', `Bearer ${init.bearer}`)
  return new Request(`http://mailsink.test${path}`, { ...init, headers })
}
