import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { Executor } from '../client'
import { newId } from '../ids'
import { blobs } from '../schema/blobs'

export interface StoredBlob {
  id: string
  sha256: string
  sizeBytes: number
}

/**
 * Content-addressed insert (D8): the same bytes in the same workspace are stored once.
 * Concurrent writers of identical bytes converge on one row: `on conflict do nothing`
 * waits for the other transaction, then the select reads its row.
 */
export async function putBlob(
  db: Executor,
  workspaceId: string,
  data: Uint8Array,
): Promise<StoredBlob> {
  const sha256 = createHash('sha256').update(data).digest('hex')
  const [inserted] = await db
    .insert(blobs)
    .values({ id: newId('blob'), workspaceId, sha256, sizeBytes: data.byteLength, data })
    .onConflictDoNothing({ target: [blobs.workspaceId, blobs.sha256] })
    .returning({ id: blobs.id, sha256: blobs.sha256, sizeBytes: blobs.sizeBytes })
  if (inserted) return inserted
  const [existing] = await db
    .select({ id: blobs.id, sha256: blobs.sha256, sizeBytes: blobs.sizeBytes })
    .from(blobs)
    .where(and(eq(blobs.workspaceId, workspaceId), eq(blobs.sha256, sha256)))
    .limit(1)
  if (!existing) throw new Error(`blob ${sha256} vanished during deduplication`)
  return existing
}

/** Bytes of a blob of the workspace, undefined when unknown. */
export async function getBlobData(
  db: Executor,
  workspaceId: string,
  id: string,
): Promise<Uint8Array | undefined> {
  const [row] = await db
    .select({ data: blobs.data })
    .from(blobs)
    .where(and(eq(blobs.workspaceId, workspaceId), eq(blobs.id, id)))
    .limit(1)
  return row ? new Uint8Array(row.data) : undefined
}
