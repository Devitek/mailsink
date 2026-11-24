import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test'
import { ADMIN_KEY, BASE_URL } from '../web-server'

// Plain `APIRequestContext` helpers kept for the UI scenarios of this repository (inbox,
// settings, overrides...), which create workspaces of their own. The recipe itself uses
// @devitek/mailsink-playwright (./fixtures.ts).

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

/**
 * `DELETE /admin/workspaces/:id` for teardowns. A context idle for longer than the server
 * keep-alive timeout may reuse a socket the server is closing: the request then fails with
 * ECONNRESET before reaching the server, so retrying it is safe (#118).
 */
export const deleteWorkspace = (admin: APIRequestContext, idOrSlug: string) =>
  admin.delete(`/admin/workspaces/${idOrSlug}`, { maxRetries: 3 })

/** `POST /admin/workspaces`: an ephemeral workspace with one native connection. */
export async function createWorkspace(
  playwright: Playwright,
  admin: APIRequestContext,
  name: string,
): Promise<E2eWorkspace & { dispose: () => Promise<void> }> {
  const res = await admin.post('/admin/workspaces', {
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
      await deleteWorkspace(admin, id)
    },
  }
}
