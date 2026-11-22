// Test-only fixtures (direct inserts): the ingestion pipeline lives in another lot.
import type { DeliveryStatus } from '@mailsink/contracts'
import {
  type Executor,
  enqueueJobs,
  messageRecipients,
  messages,
  newId,
  workspaces,
} from '@mailsink/db'

export async function insertWorkspace(db: Executor): Promise<string> {
  const id = newId('ws')
  await db.insert(workspaces).values({ id, slug: id, name: 'Simulation', createdVia: 'admin_api' })
  return id
}

export interface RecipientSeed {
  email: string
  status?: DeliveryStatus
}

/** A message as ingestion leaves it: `queued`, its recipients, its `simulate_delivery` job. */
export async function insertQueuedMessage(
  db: Executor,
  workspaceId: string,
  recipients: RecipientSeed[],
  options: { job?: boolean } = {},
): Promise<string> {
  const id = newId('msg')
  await db.insert(messages).values({
    id,
    workspaceId,
    source: 'native',
    providerMessageId: id,
    from: { email: 'app@example.com' },
    sizeBytes: 42,
  })
  await db.insert(messageRecipients).values(
    recipients.map((r) => ({
      id: newId('rcp'),
      messageId: id,
      workspaceId,
      kind: 'to' as const,
      email: r.email,
      status: r.status ?? 'queued',
    })),
  )
  if (options.job !== false) {
    await enqueueJobs(db, [{ kind: 'simulate_delivery', workspaceId, payload: { messageId: id } }])
  }
  return id
}
