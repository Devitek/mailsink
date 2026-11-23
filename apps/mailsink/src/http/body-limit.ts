import { DomainError } from '@mailsink/core'

/**
 * Default body cap of a defineApi route: 1 MiB. Control-plane bodies (admin, capture) are
 * small JSON documents (a workspace with 20 connections, its metadata and simulation
 * settings stays under a few KiB), so a full message cap would only widen the memory a
 * single request can pin. Ingestion routes opt into `MAILSINK_MAX_MESSAGE_BYTES` instead.
 */
export const DEFAULT_MAX_BODY_BYTES = 1024 * 1024

/** A route body cap: bytes, or `'message'` for `MAILSINK_MAX_MESSAGE_BYTES`. */
export type BodyCap = number | 'message'

/** The byte cap of a route, `DEFAULT_MAX_BODY_BYTES` when it sets none. */
export function resolveBodyCap(cap: BodyCap | undefined, maxMessageBytes: number): number {
  if (cap === 'message') return maxMessageBytes
  return cap ?? DEFAULT_MAX_BODY_BYTES
}

const tooLarge = (maxBytes: number) =>
  new DomainError('payload_too_large', `Request body exceeds the ${maxBytes} bytes limit`, {
    details: { maxBytes },
  })

/** Bytes read by limitBody, per original request: the request log reuses them (D157). */
const buffered = new WeakMap<Request, Uint8Array>()

/** The body limitBody already read for this request, if any. */
export const bufferedBodyOf = (request: Request): Uint8Array | undefined => buffered.get(request)

/**
 * Reads the request body with a size cap (see resolveBodyCap) before any parsing:
 * a declared `Content-Length` above the cap is refused without reading, a streamed body is
 * cut as soon as it crosses it. Returns a copy of the request holding the buffered body,
 * also kept for the request log (bufferedBodyOf).
 */
export async function limitBody(request: Request, maxBytes: number): Promise<Request> {
  const declared = Number(request.headers.get('content-length') ?? Number.NaN)
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge(maxBytes)
  if (!request.body) return request
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel().catch(() => {})
      throw tooLarge(maxBytes)
    }
    chunks.push(value)
  }
  const bytes = Buffer.concat(chunks)
  buffered.set(request, bytes)
  return new Request(request.url, { method: request.method, headers: request.headers, body: bytes })
}
