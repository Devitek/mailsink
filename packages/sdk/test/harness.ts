// Shared setup of the SDK integration tests: the app runtime on the test database (both
// drivers through describeDb), its HTTP routes on a loopback port, an admin client and a
// fresh workspace with one Resend connection.
import { createJobRunner, simulateDeliveryHandler, startWorker, type Worker } from '@mailsink/core'
import type { DbTestContext } from '@mailsink/db/testing'
import { afterAll, beforeAll } from 'vitest'
import { ADMIN_KEY, installTestRuntime } from '../../../apps/mailsink/src/http/test-fixtures'
import { stopRuntime } from '../../../apps/mailsink/src/runtime/boot'
import { createMailsink, type Mailsink } from '../src'
import { startTestServer, type TestServer } from './server'

export interface Harness {
  server: TestServer
  admin: Mailsink
  /** Client scoped to `workspaceId` through its `mskw_` key. */
  sink: Mailsink
  workspaceId: string
  workspaceKey: string
  connectionId: string
  /** `msk_` key of the Resend connection, for native ingestion. */
  connectionKey: string
  /** Sends one email through `POST /v1/emails`; resolves its message id. */
  send(email: { to?: string; subject: string; text?: string; html?: string }): Promise<string>
}

export interface HarnessOptions {
  /** Runs the delivery simulation jobs (statuses, bounces) every 100 ms. */
  worker?: boolean
}

export function useHarness(ctx: DbTestContext, options: HarnessOptions = {}): Harness {
  const h = {} as Harness
  let worker: Worker | undefined
  beforeAll(async () => {
    const runtime = await installTestRuntime(ctx.handle)
    if (options.worker) {
      const runJobs = createJobRunner({
        db: runtime.db.db,
        handlers: { simulate_delivery: simulateDeliveryHandler({ bus: runtime.bus }) },
      })
      worker = startWorker({
        intervalMs: 100,
        tick: async (signal) => {
          await runJobs(signal)
        },
      })
    }
    h.server = await startTestServer()
    h.admin = createMailsink({ url: h.server.url, adminKey: ADMIN_KEY, validate: true })
    const created = await h.admin.admin.workspaces.create({
      name: 'SDK tests',
      ephemeral: true,
      connections: [{ kind: 'resend', name: 'App' }],
    })
    const connection = created.connections[0]
    if (connection?.credentials.kind !== 'resend') throw new Error('no resend connection')
    h.workspaceId = created.workspace.id
    h.workspaceKey = created.workspaceKey
    h.connectionId = connection.id
    h.connectionKey = connection.credentials.apiKey
    h.sink = h.admin.with({ key: created.workspaceKey, adminKey: undefined })
    h.send = async ({ to = 'jane@example.com', subject, text = 'Hello', html }) => {
      const response = await fetch(`${h.server.url}/v1/emails`, {
        method: 'POST',
        headers: { authorization: `Bearer ${h.connectionKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: 'App <app@example.com>', to, subject, text, html }),
      })
      if (!response.ok) throw new Error(`send: ${response.status} ${await response.text()}`)
      return ((await response.json()) as { id: string }).id
    }
  })
  afterAll(async () => {
    await worker?.stop()
    await h.server?.close()
    await stopRuntime()
  })
  return h
}
