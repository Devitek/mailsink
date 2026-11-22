/** Reference to stored bytes: content-addressed per workspace (D8). */
export interface BlobRef {
  id: string
  sha256: string
  sizeBytes: number
}

/**
 * Binary storage for raw EML and attachments (D8). The database driver is the only one
 * today; a filesystem or S3 driver can implement the same interface later.
 */
export interface BlobStore {
  /** Stores the bytes once per workspace (same sha256 = same blob). */
  put(workspaceId: string, data: Uint8Array): Promise<BlobRef>
  /** The bytes, or undefined when the blob does not exist in this workspace. */
  get(workspaceId: string, id: string): Promise<Uint8Array | undefined>
}
