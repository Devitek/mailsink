// Shared bits of the integration tests: the SDK harness (app runtime and HTTP routes on a
// loopback port, both drivers) and a sender through the native endpoint.
import { ADMIN_KEY } from '../../../apps/mailsink/src/http/test-fixtures'
import type { MailsinkWorkspace } from '../src'

export { useHarness } from '../../sdk/test/harness'
export { ADMIN_KEY }

export interface Email {
  to: string
  subject: string
  html?: string
  text?: string
}

/** Sends one email into `workspace` through `POST /v1/emails`; resolves its message id. */
export async function sendTo(workspace: MailsinkWorkspace, email: Email): Promise<string> {
  const response = await fetch(`${workspace.url}/v1/emails`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${workspace.credentials('resend').apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from: 'Acme <hello@acme.example.com>', text: 'Hello', ...email }),
  })
  if (!response.ok) throw new Error(`send: ${response.status} ${await response.text()}`)
  return ((await response.json()) as { id: string }).id
}
