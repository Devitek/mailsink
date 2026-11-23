// Test-only helpers of the Brevo dialect (imported by *.test.ts files only).
import { postWorkspace } from '../../admin/workspaces'
import { ADMIN_KEY, request } from '../../test-fixtures'

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
