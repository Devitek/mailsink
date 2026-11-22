import { DomainError } from '@mailsink/core'

const tooLarge = (maxBytes: number) =>
  new DomainError('payload_too_large', `Request body exceeds the ${maxBytes} bytes limit`, {
    details: { maxBytes },
  })

/**
 * Reads the request body with a size cap (`MAILSINK_MAX_MESSAGE_BYTES`) before any parsing:
 * a declared `Content-Length` above the cap is refused without reading, a streamed body is
 * cut as soon as it crosses it. Returns a copy of the request holding the buffered body.
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
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: Buffer.concat(chunks),
  })
}
