import { type Executor, getBlobData, putBlob } from '@mailsink/db'
import type { BlobStore } from './store'

/**
 * BlobStore on the `blobs` table. Bound to an executor, so blobs written during ingestion
 * belong to the ingestion transaction and vanish with it on rollback.
 */
export function createDbBlobStore(db: Executor): BlobStore {
  return {
    put: (workspaceId, data) => putBlob(db, workspaceId, data),
    get: (workspaceId, id) => getBlobData(db, workspaceId, id),
  }
}
