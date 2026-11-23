// Test-only helpers for the HTTP layer (imported by *.test.ts files only).
import { randomBytes } from 'node:crypto'
import {
  createActivityTracker,
  createEventBus,
  createLogWriter,
  createRateLimiter,
  hashApiKey,
  type Random,
  type RateLimiter,
} from '@mailsink/core'
import { apiKeys, type Database, type DbHandle, newId } from '@mailsink/db'
import { createTestWorkspaceWithConnection } from '@mailsink/db/testing'
import { bootRuntime } from '../runtime/boot'
import type { RuntimeConfig } from '../runtime/config'
import type { Runtime } from '../runtime/container'

export const ADMIN_KEY = 'test-admin-key-0123456789'

/** Puts a runtime around the test database in the globalThis slot, as the Nitro plugin does. */
export function installTestRuntime(
  db: DbHandle,
  config: Partial<RuntimeConfig> = {},
  services: { rateLimiter?: RateLimiter; chaosRandom?: Random } = {},
) {
  const bus = createEventBus()
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
    bus,
    activity: createActivityTracker({ db: db.db }),
    rateLimiter: services.rateLimiter ?? createRateLimiter(),
    chaosRandom: services.chaosRandom ?? Math.random,
    logs: createLogWriter({ db: db.db, bus }),
    smtpPort: 0,
    stop: async () => {},
  }
  const silent = { info: () => {}, warn: () => {}, error: () => {} }
  return bootRuntime({ start: async () => runtime, log: silent, shutdownHooks: false })
}

const token = (prefix: string) => `${prefix}${randomBytes(18).toString('base64url')}`

/** A workspace with one connection, its `msk_` key and a `mskw_` workspace key. */
export async function seedWorkspace(db: Database, options: { disabled?: boolean } = {}) {
  const { workspace, connection } = await createTestWorkspaceWithConnection(db, {
    workspace: { name: 'Team' },
    connection: { disabledAt: options.disabled ? new Date() : null },
  })
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
