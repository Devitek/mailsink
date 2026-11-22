import { createHash } from 'node:crypto'
import {
  type Database,
  type Executor,
  findIdempotencyRecord,
  insertIdempotencyRecord,
} from '@mailsink/db'
import { DomainError } from '../errors'

export const IDEMPOTENCY_HEADER = 'Idempotency-Key'
export const IDEMPOTENCY_TTL_MS = 24 * 3600 * 1000
export const MAX_IDEMPOTENCY_KEY_LENGTH = 256

export interface IdempotencyRequest {
  key: string
  /** hashRequest() of the route and body: a different body under the same key is a 409. */
  requestHash: string
}

export interface StoredResponse {
  status: number
  body: unknown
}

/** JSON with sorted object keys, so equal bodies hash equally whatever the key order. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** Hash of a request: its scope (route) and its body. */
export function hashRequest(scope: string, body: unknown): string {
  return createHash('sha256').update(scope).update('\n').update(stableJson(body)).digest('hex')
}

/** `Idempotency-Key` header value, undefined when absent; over 256 characters is a 400. */
export function readIdempotencyKey(headers: Headers): string | undefined {
  const key = headers.get(IDEMPOTENCY_HEADER)?.trim()
  if (!key) return undefined
  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new DomainError(
      'validation_error',
      `${IDEMPOTENCY_HEADER} must be at most ${MAX_IDEMPOTENCY_KEY_LENGTH} characters`,
      { status: 400 },
    )
  }
  return key
}

async function replay(
  db: Executor,
  workspaceId: string,
  request: IdempotencyRequest,
): Promise<StoredResponse | undefined> {
  const record = await findIdempotencyRecord(db, workspaceId, request.key)
  if (!record) return undefined
  if (record.requestHash !== request.requestHash) {
    throw new DomainError(
      'idempotency_mismatch',
      `${IDEMPOTENCY_HEADER} was already used with a different request body`,
    )
  }
  return { status: record.responseStatus, body: record.responseBody }
}

export interface IdempotentWork<P> {
  /** Work done outside the transaction (validation, EML composition); skipped on replay. */
  prepare: () => Promise<P>
  /** Writes in the transaction and returns the response to store. */
  persist: (tx: Executor, prepared: P) => Promise<StoredResponse>
}

/**
 * Runs `work` once per key and workspace for 24 h. A known key with the
 * same request replays the stored response (`replayed: true`); with another body it fails
 * with `idempotency_mismatch`. The record is written in the same transaction as the
 * messages, so a replay never sees a half-ingested request. When two requests race on a
 * new key, the loser's transaction fails on the primary key and it replays the winner.
 */
export async function runIdempotent<P>(
  db: Database,
  workspaceId: string,
  request: IdempotencyRequest | undefined,
  work: IdempotentWork<P>,
): Promise<{ response: StoredResponse; replayed: boolean }> {
  if (!request) {
    const prepared = await work.prepare()
    return { response: await db.transaction((tx) => work.persist(tx, prepared)), replayed: false }
  }
  const known = await replay(db, workspaceId, request)
  if (known) return { response: known, replayed: true }
  const prepared = await work.prepare()
  try {
    const response = await db.transaction(async (tx) => {
      const out = await work.persist(tx, prepared)
      const now = new Date()
      await insertIdempotencyRecord(
        tx,
        {
          workspaceId,
          key: request.key,
          requestHash: request.requestHash,
          responseStatus: out.status,
          responseBody: out.body,
          expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        },
        now,
      )
      return out
    })
    return { response, replayed: false }
  } catch (error) {
    const winner = await replay(db, workspaceId, request)
    if (winner) return { response: winner, replayed: true }
    throw error
  }
}
