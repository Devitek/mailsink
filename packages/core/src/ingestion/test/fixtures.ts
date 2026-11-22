// Test-only helpers of the ingestion module (imported by *.test.ts files only).
import type { SendEmailRequestInput } from '@mailsink/contracts'
import { connections, type Executor, newId, suppressions, workspaces } from '@mailsink/db'
import type { IngestTarget } from '../normalize'

/** A workspace with one Resend connection, as the ingestion target. */
export async function seedTarget(db: Executor): Promise<IngestTarget> {
  const workspaceId = newId('ws')
  await db.insert(workspaces).values({
    id: workspaceId,
    slug: workspaceId.toLowerCase().replace(/_/g, '-'),
    name: 'Team',
    createdVia: 'admin_api',
  })
  const connectionId = newId('con')
  await db
    .insert(connections)
    .values({ id: connectionId, workspaceId, name: 'Resend', kind: 'resend' })
  return { workspaceId, connectionId, source: 'native' }
}

export async function suppress(db: Executor, workspaceId: string, email: string): Promise<void> {
  await db
    .insert(suppressions)
    .values({ id: newId('sup'), workspaceId, email, reason: 'hard_bounce' })
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
