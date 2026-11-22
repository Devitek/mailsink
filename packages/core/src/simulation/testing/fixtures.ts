// Test-only fixtures of the simulation and jobs modules, built on @mailsink/db/testing.
import { type Executor, enqueueJobs } from '@mailsink/db'
import { createTestMessage, createTestRecipients, type TestRecipient } from '@mailsink/db/testing'

/** A message as ingestion leaves it: `queued`, its recipients, its `simulate_delivery` job. */
export async function insertQueuedMessage(
  db: Executor,
  workspaceId: string,
  recipients: TestRecipient[],
  options: { job?: boolean } = {},
): Promise<string> {
  const message = await createTestMessage(db, workspaceId)
  await createTestRecipients(db, message, recipients)
  if (options.job !== false) {
    await enqueueJobs(db, [
      { kind: 'simulate_delivery', workspaceId, payload: { messageId: message.id } },
    ])
  }
  return message.id
}
