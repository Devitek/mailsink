// Test-only helper of the Resend dialect (imported by *.test.ts files only).
import { postWorkspace } from '../../admin/workspaces'
import { ADMIN_KEY, request } from '../../test-fixtures'

/** A workspace with a resend and a brevo connection, created through the Admin API. */
export async function createResendWorkspace(patch: Record<string, unknown> = {}) {
  const res = await postWorkspace({
    request: request('/admin/workspaces', {
      method: 'POST',
      bearer: ADMIN_KEY,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Resend dialect',
        connections: [
          { kind: 'resend', name: 'app' },
          { kind: 'brevo', name: 'other' },
        ],
        ...patch,
      }),
    }),
  })
  if (res.status !== 201 && res.status !== 200) throw new Error(`seed failed: ${res.status}`)
  const created = await res.json()
  const [resend, brevo] = created.connections
  return {
    workspaceId: created.workspace.id as string,
    workspaceKey: created.workspaceKey as string,
    resendKey: resend.credentials.apiKey as string,
    resendConnectionId: resend.id as string,
    brevoKey: brevo.credentials.apiKey as string,
  }
}
