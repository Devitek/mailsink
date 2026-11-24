import {
  type CreatedConnection,
  createMailsink,
  isMailsinkError,
  type Mailsink,
} from '@devitek/mailsink'
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test'
import { ADMIN_KEY, BASE_URL } from './web-server'

// Workspaces of the UI scenarios of this repository (inbox, settings, overrides...), which
// create their own instead of the worker workspace of @devitek/mailsink-playwright (the
// recipe, ./recipe/fixtures.ts). Setup and Capture API assertions go through the SDK; the
// raw `adminContext` stays for the scenarios asserting on HTTP itself (status, headers).

export interface E2eWorkspace {
  id: string
  slug: string
  /** `mskw_` key: Capture API (assertions, overrides, reset). */
  workspaceKey: string
  /** The native connection the app under test sends with. */
  connection: CreatedConnection
  /** `msk_` key of that connection. */
  connectionKey: string
  /** SDK client scoped to the workspace. */
  sink: Mailsink
  /** What the app under test does: here, the native API with the connection key. */
  send: (email: Record<string, unknown>) => Promise<string>
  /** Deletes the workspace; already gone is fine. */
  dispose: () => Promise<void>
}

/** SDK client with the admin key; the key never leaves the test runner. */
export const adminSdk = (): Mailsink => createMailsink({ url: BASE_URL, adminKey: ADMIN_KEY })

/** `POST /admin/workspaces`: an ephemeral workspace with one Resend connection. */
export async function createWorkspace(name: string): Promise<E2eWorkspace> {
  const admin = adminSdk()
  const created = await admin.admin.workspaces.create({
    name,
    ephemeral: true,
    idleTtlSeconds: 600,
    metadata: { createdBy: `playwright · ${name}` },
    connections: [{ kind: 'resend', name }],
  })
  const connection = created.connections[0]
  if (connection?.credentials.kind !== 'resend') throw new Error('no resend connection')
  const connectionKey = connection.credentials.apiKey
  return {
    id: created.workspace.id,
    slug: created.workspace.slug,
    workspaceKey: created.workspaceKey,
    connection,
    connectionKey,
    sink: admin.with({ key: created.workspaceKey, adminKey: undefined }),
    async send(email) {
      const sent = await fetch(`${BASE_URL}/v1/emails`, {
        method: 'POST',
        headers: { authorization: `Bearer ${connectionKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(email),
      })
      if (!sent.ok) throw new Error(`send: ${sent.status} ${await sent.text()}`)
      return ((await sent.json()) as { id: string }).id
    },
    dispose: () => removeWorkspace(admin, created.workspace.id),
  }
}

/** `DELETE /admin/workspaces/:id` through the SDK, retried on a reset socket (#118). */
async function removeWorkspace(admin: Mailsink, id: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await admin.admin.workspaces.delete(id)
    } catch (error) {
      if (isMailsinkError(error, 'not_found')) return
      if (!isMailsinkError(error, 'network_error') || attempt >= 3) throw error
    }
  }
}

type Playwright = PlaywrightWorkerArgs['playwright']

/** Raw Admin API client, for the scenarios asserting on HTTP answers themselves. */
export const adminContext = (playwright: Playwright) =>
  playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { authorization: `Bearer ${ADMIN_KEY}` },
  })

/**
 * `DELETE /admin/workspaces/:id` for teardowns. A context idle for longer than the server
 * keep-alive timeout may reuse a socket the server is closing: the request then fails with
 * ECONNRESET before reaching the server, so retrying it is safe (#118).
 */
export const deleteWorkspace = (admin: APIRequestContext, idOrSlug: string) =>
  admin.delete(`/admin/workspaces/${idOrSlug}`, { maxRetries: 3 })
