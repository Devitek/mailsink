// Test-only fixtures for the capture API: captured messages written with direct inserts,
// independent of the ingestion pipeline (exported as @mailsink/core/capture-testing).
import { createHash, randomBytes } from 'node:crypto'
import {
  attachments,
  blobs,
  connections,
  type Database,
  messageEvents,
  messageRecipients,
  messages,
  newId,
  workspaces,
} from '@mailsink/db'

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

export async function insertCaptureWorkspace(db: Database) {
  const suffix = randomBytes(4).toString('hex')
  const [workspace] = await db
    .insert(workspaces)
    .values({ id: newId('ws'), slug: `cap-${suffix}`, name: 'Capture', createdVia: 'admin_api' })
    .returning()
  if (!workspace) throw new Error('workspace not inserted')
  const [connection] = await db
    .insert(connections)
    .values({ id: newId('con'), workspaceId: workspace.id, name: 'Resend', kind: 'resend' })
    .returning()
  if (!connection) throw new Error('connection not inserted')
  return { workspace, connection }
}

export async function insertBlob(db: Database, workspaceId: string, content: string | Uint8Array) {
  const data = typeof content === 'string' ? new TextEncoder().encode(content) : content
  const sha256 = createHash('sha256').update(data).digest('hex')
  const id = newId('blob')
  const [row] = await db
    .insert(blobs)
    .values({ id, workspaceId, sha256, sizeBytes: data.byteLength, data })
    .onConflictDoUpdate({ target: [blobs.workspaceId, blobs.sha256], set: { sha256 } })
    .returning({ id: blobs.id })
  if (!row) throw new Error('blob not inserted')
  return row.id
}

const addr = (a: string | { email: string; name?: string }) =>
  typeof a === 'string' ? { email: a } : a

export async function insertCapturedMessage(
  db: Database,
  workspaceId: string,
  f: MessageFixture = {},
) {
  const id = newId('msg', f.createdAt?.getTime())
  const rawBlobId = f.raw === undefined ? undefined : await insertBlob(db, workspaceId, f.raw)
  await db.insert(messages).values({
    id,
    workspaceId,
    connectionId: f.connectionId ?? null,
    source: 'native',
    providerMessageId: id,
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
  const recipients = [
    ...(f.to ?? ['jane@example.com']).map((a) => ({ kind: 'to' as const, ...addr(a) })),
    ...(f.cc ?? []).map((email) => ({ kind: 'cc' as const, email })),
    ...(f.bcc ?? []).map((email) => ({ kind: 'bcc' as const, email })),
  ]
  await db.insert(messageRecipients).values(
    recipients.map((r) => ({
      id: newId('rcp'),
      messageId: id,
      workspaceId,
      kind: r.kind,
      email: r.email,
      name: 'name' in r ? r.name : undefined,
      status: f.status ?? 'delivered',
    })),
  )
  const atts = []
  for (const a of f.attachments ?? []) {
    const blobId = await insertBlob(db, workspaceId, a.content)
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
