// Body reading of the request log (logs-extension.ts): never throws, never unbounded.

/**
 * Text of a body stream, or null when it is empty, unreadable (client gone) or longer than
 * `maxBytes` (the call is then refused with 413 anyway).
 */
export async function readCapped(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<string | null> {
  if (!body) return null
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel().catch(() => {})
        return null
      }
      chunks.push(value)
    }
  } catch {
    return null
  }
  if (size === 0) return null
  return Buffer.concat(chunks).toString('utf8')
}

const JSON_TYPE = /^application\/([\w.+-]*\+)?json\b/i

/** Only JSON and text bodies are logged; downloads, SSE and binaries are not. */
export function isLoggableType(contentType: string | null): boolean {
  if (!contentType) return false
  if (/^text\/event-stream/i.test(contentType)) return false
  return JSON_TYPE.test(contentType) || /^text\//i.test(contentType)
}

/** JSON.parse that answers undefined instead of throwing. */
export function parseJson(text: string | null): unknown {
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
