import { type APIRequestContext, test as base, type PlaywrightWorkerArgs } from '@playwright/test'
import { ADMIN_KEY, BASE_URL } from '../web-server'

// The E2E recipe of docs/guides/e2e.md: one ephemeral workspace per Playwright worker,
// created through the Admin API, reset before each test, deleted when the worker ends.

export interface E2eWorkspace {
  id: string
  /** `mskw_` key: Capture API (assertions, overrides, reset). */
  workspaceKey: string
  /** `msk_` key of the connection the app under test sends with. */
  connectionKey: string
  /** Capture API client, authenticated with the workspace key. */
  capture: APIRequestContext
  /** What the app under test does: here, the native API with the connection key. */
  send: (email: Record<string, unknown>) => Promise<string>
}

type Playwright = PlaywrightWorkerArgs['playwright']

const bearer = (key: string) => ({ authorization: `Bearer ${key}` })

/** Admin API client; the admin key never leaves the test runner. */
export const adminContext = (playwright: Playwright) =>
  playwright.request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: bearer(ADMIN_KEY) })

/** `POST /admin/workspaces`: an ephemeral workspace with one native connection. */
export async function createWorkspace(
  playwright: Playwright,
  admin: APIRequestContext,
  name: string,
): Promise<E2eWorkspace & { dispose: () => Promise<void> }> {
  const res = await admin.post('/admin/workspaces', {
    // The idle TTL is the safety net: a worker killed before its teardown leaves a
    // workspace the GC deletes 10 minutes after its last call.
    data: {
      name,
      ephemeral: true,
      idleTtlSeconds: 600,
      metadata: { createdBy: `playwright · ${name}` },
      connections: [{ kind: 'resend', name }],
    },
  })
  if (res.status() !== 201)
    throw new Error(`workspace creation: ${res.status()} ${await res.text()}`)
  const body = await res.json()
  const id: string = body.workspace.id
  const connectionKey: string = body.connections[0].credentials.apiKey
  const capture = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: bearer(body.workspaceKey),
  })
  const ingest = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: bearer(connectionKey),
  })
  return {
    id,
    workspaceKey: body.workspaceKey,
    connectionKey,
    capture,
    async send(email) {
      const sent = await ingest.post('/v1/emails', { data: email })
      if (!sent.ok()) throw new Error(`send: ${sent.status()} ${await sent.text()}`)
      return (await sent.json()).id
    },
    async dispose() {
      await Promise.all([capture.dispose(), ingest.dispose()])
      // 404 is fine: a test may have deleted it already.
      await admin.delete(`/admin/workspaces/${id}`)
    },
  }
}

/** Back to a blank workspace: no message, no override, empty suppression list. */
export async function resetWorkspace(capture: APIRequestContext): Promise<void> {
  for (const res of await Promise.all([
    capture.delete('/capture/messages'),
    capture.post('/capture/override/reset', { data: {} }),
    capture.delete('/capture/suppressions'),
  ])) {
    if (!res.ok()) throw new Error(`reset: ${res.status()} ${await res.text()}`)
  }
}

export const test = base.extend<{ mailsink: E2eWorkspace }, { workerWorkspace: E2eWorkspace }>({
  workerWorkspace: [
    async ({ playwright }, use, workerInfo) => {
      const admin = await adminContext(playwright)
      const workspace = await createWorkspace(playwright, admin, `e2e-${workerInfo.workerIndex}`)
      await use(workspace)
      await workspace.dispose()
      await admin.dispose()
    },
    { scope: 'worker' },
  ],
  mailsink: async ({ workerWorkspace }, use) => {
    await resetWorkspace(workerWorkspace.capture)
    await use(workerWorkspace)
  },
})

export { expect } from '@playwright/test'
