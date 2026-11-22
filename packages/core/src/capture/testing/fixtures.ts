// Test-only fixtures for the capture API: captured messages written with direct inserts,
// independent of the ingestion pipeline (exported as @mailsink/core/capture-testing). Plain
// workspaces, connections and blobs come from @mailsink/db/testing.
import { attachments, type Database, messageEvents, type messages, newId } from '@mailsink/db'
import { createTestBlob, createTestMessage, createTestRecipients } from '@mailsink/db/testing'

type Status = (typeof messages.$inferInsert)['status']
type EventInsert = Omit<typeof messageEvents.$inferInsert, 'id' | 'workspaceId' | 'messageId'>

export interface AttachmentFixture {
  filename?: string | null
  contentType: string
  content: string | Uint8Array
  disposition?: 'attachment' | 'inline'
  contentId?: string
}

export interface MessageFixture {
  connectionId?: string | null
  subject?: string
  from?: { email: string; name?: string }
  to?: (string | { email: string; name?: string })[]
  cc?: string[]
  bcc?: string[]
  replyTo?: { email: string; name?: string }[]
  html?: string | null
  text?: string | null
  tags?: { name: string; value: string }[]
  metadata?: Record<string, unknown>
  headers?: Record<string, string>
  status?: Status
  createdAt?: Date
  /** Raw EML; absent = no raw blob. */
  raw?: string
  attachments?: AttachmentFixture[]
  events?: EventInsert[]
}

const addr = (a: string | { email: string; name?: string }) =>
  typeof a === 'string' ? { email: a } : a

export async function insertCapturedMessage(
  db: Database,
  workspaceId: string,
  f: MessageFixture = {},
) {
  const rawBlobId = f.raw === undefined ? undefined : await createTestBlob(db, workspaceId, f.raw)
  const { id } = await createTestMessage(db, workspaceId, {
    connectionId: f.connectionId ?? null,
    from: f.from ?? { email: 'app@example.com', name: 'App' },
    replyTo: f.replyTo,
    subject: f.subject ?? 'Hello',
    html: f.html === undefined ? '<p>Hello</p>' : f.html,
    text: f.text === undefined ? 'Hello' : f.text,
    headers: f.headers ?? {},
    tags: f.tags ?? [],
    metadata: f.metadata,
    rawBlobId,
    sizeBytes: f.raw?.length ?? 42,
    status: f.status ?? 'delivered',
    ...(f.createdAt ? { createdAt: f.createdAt } : {}),
  })
  const status = f.status ?? 'delivered'
  await createTestRecipients(db, { id, workspaceId }, [
    ...(f.to ?? ['jane@example.com']).map((a) => ({ kind: 'to' as const, status, ...addr(a) })),
    ...(f.cc ?? []).map((email) => ({ kind: 'cc' as const, status, email })),
    ...(f.bcc ?? []).map((email) => ({ kind: 'bcc' as const, status, email })),
  ])
  const atts = []
  for (const a of f.attachments ?? []) {
    const blobId = await createTestBlob(db, workspaceId, a.content)
    const size = typeof a.content === 'string' ? Buffer.byteLength(a.content) : a.content.length
    atts.push({
      id: newId('att'),
      messageId: id,
      filename: a.filename === undefined ? 'file.bin' : a.filename,
      contentType: a.contentType,
      contentId: a.contentId,
      disposition: a.disposition ?? 'attachment',
      sizeBytes: size,
      blobId,
    })
  }
  if (atts.length) await db.insert(attachments).values(atts)
  if (f.events?.length) {
    await db
      .insert(messageEvents)
      .values(f.events.map((e) => ({ id: newId('evt'), workspaceId, messageId: id, ...e })))
  }
  return { id, attachmentIds: atts.map((a) => a.id) }
}
