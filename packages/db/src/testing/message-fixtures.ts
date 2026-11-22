// Direct-insert message fixtures shared by the tests of every package (see fixtures.ts).
import { createHash } from 'node:crypto'
import type { Executor } from '../client'
import { newId } from '../ids'
import { blobs, messageRecipients, messages } from '../schema'

type MessageInsert = typeof messages.$inferInsert
type RecipientInsert = typeof messageRecipients.$inferInsert

/**
 * A native message of `workspaceId` with no recipients; `patch` overrides any column. The
 * id carries `patch.createdAt` when given, so ids and creation times sort alike.
 */
export async function createTestMessage(
  db: Executor,
  workspaceId: string,
  patch: Partial<MessageInsert> = {},
) {
  const id = patch.id ?? newId('msg', patch.createdAt?.getTime())
  const [row] = await db
    .insert(messages)
    .values({
      id,
      workspaceId,
      source: 'native',
      providerMessageId: id,
      from: { email: 'app@example.com' },
      sizeBytes: 42,
      ...patch,
    })
    .returning()
  if (!row) throw new Error('message not inserted')
  return row
}

export interface TestRecipient {
  email: string
  name?: string
  kind?: RecipientInsert['kind']
  status?: RecipientInsert['status']
}

/** Recipients of a message (`to` and `queued` unless stated). */
export async function createTestRecipients(
  db: Executor,
  message: { id: string; workspaceId: string },
  recipients: readonly TestRecipient[],
) {
  if (recipients.length === 0) return []
  return db
    .insert(messageRecipients)
    .values(
      recipients.map((r) => ({
        id: newId('rcp'),
        messageId: message.id,
        workspaceId: message.workspaceId,
        kind: r.kind ?? 'to',
        email: r.email,
        name: r.name,
        status: r.status ?? 'queued',
      })),
    )
    .returning()
}

/** A content-addressed blob; the same content in the same workspace returns the same id. */
export async function createTestBlob(
  db: Executor,
  workspaceId: string,
  content: string | Uint8Array,
): Promise<string> {
  const data = typeof content === 'string' ? new TextEncoder().encode(content) : content
  const sha256 = createHash('sha256').update(data).digest('hex')
  const [row] = await db
    .insert(blobs)
    .values({ id: newId('blob'), workspaceId, sha256, sizeBytes: data.byteLength, data })
    .onConflictDoUpdate({ target: [blobs.workspaceId, blobs.sha256], set: { sha256 } })
    .returning({ id: blobs.id })
  if (!row) throw new Error('blob not inserted')
  return row.id
}
