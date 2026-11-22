// Test-only helpers of the ingestion module (imported by *.test.ts files only).
import type { SendEmailRequestInput } from '@mailsink/contracts'
import type { Executor } from '@mailsink/db'
import { createTestWorkspaceWithConnection } from '@mailsink/db/testing'
import type { IngestTarget } from '../normalize'

/** A workspace with one Resend connection, as the ingestion target. */
export async function seedTarget(db: Executor): Promise<IngestTarget> {
  const { workspace, connection } = await createTestWorkspaceWithConnection(db)
  return { workspaceId: workspace.id, connectionId: connection.id, source: 'native' }
}

export const sampleRequest = (
  patch: Partial<SendEmailRequestInput> = {},
): SendEmailRequestInput => ({
  from: 'App <app@example.com>',
  to: 'jane@x.io',
  subject: 'Welcome',
  html: '<p>Hi, <a href="https://app.io/confirm">confirm</a></p>',
  ...patch,
})
