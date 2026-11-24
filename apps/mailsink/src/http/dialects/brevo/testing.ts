// Test-only helpers of the Brevo dialect (imported by *.test.ts files only).
import { postWorkspace } from '../../admin/workspaces'
import { ADMIN_KEY, request } from '../../test-fixtures'
import { deleteBrevoBlockedContact, getBrevoBlockedContacts, getBrevoEmails } from './read'
import { postBrevoEmail } from './send'

/**
 * Provisions, through the Admin API, a workspace with a `brevo` and a `resend` connection
 * plus the given template seed. Needs an installed test runtime.
 */
export async function provisionBrevo(extra: Record<string, unknown> = {}) {
  const res = await postWorkspace({
    request: request('/admin/workspaces', {
      method: 'POST',
      bearer: ADMIN_KEY,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Brevo',
        connections: [
          { kind: 'brevo', name: 'brevo' },
          { kind: 'resend', name: 'resend' },
        ],
        ...extra,
      }),
    }),
  })
  if (res.status !== 201) throw new Error(`provisioning failed: ${await res.text()}`)
  const created = await res.json()
  return {
    workspaceId: created.workspace.id as string,
    workspaceKey: created.workspaceKey as string,
    brevoConnectionId: created.connections[0].id as string,
    brevoKey: created.connections[0].credentials.apiKey as string,
    resendKey: created.connections[1].credentials.apiKey as string,
  }
}

/** The official SDK's base URL in tests: its fetch is routed by `brevoFetch`. */
export const BREVO_TEST_BASE_URL = 'http://mailsink.test/v3'

/** Routes the Brevo SDK requests to the in-process route handlers. */
export const brevoFetch: typeof fetch = async (input, init) => {
  const req = new Request(input, init)
  const { pathname } = new URL(req.url)
  const route = `${req.method} ${pathname}`
  if (route === 'POST /v3/smtp/email') return postBrevoEmail({ request: req })
  if (route === 'GET /v3/smtp/emails') return getBrevoEmails({ request: req })
  if (route === 'GET /v3/smtp/blockedContacts') return getBrevoBlockedContacts({ request: req })
  const blocked = /^DELETE \/v3\/smtp\/blockedContacts\/([^/]+)$/.exec(route)
  if (blocked)
    return deleteBrevoBlockedContact({ request: req, params: { email: blocked[1] ?? '' } })
  return new Response('not found', { status: 404 })
}
