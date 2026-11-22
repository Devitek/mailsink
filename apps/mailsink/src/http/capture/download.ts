/** Headers for binary downloads served under the app origin (raw EML, attachments). */

const TOKEN_TYPE = /^[\w!#$&^.+-]+\/[\w!#$&^.+-]+(\s*;[^\r\n]*)?$/

/** The stored content type when it is a well-formed media type, else octet-stream. */
export function safeContentType(value: string): string {
  return TOKEN_TYPE.test(value) ? value : 'application/octet-stream'
}

/** RFC 6266 `Content-Disposition` with an ASCII fallback and a UTF-8 `filename*`. */
export function contentDisposition(
  disposition: 'attachment' | 'inline',
  filename: string | null,
): string {
  if (!filename) return disposition
  const ascii = filename.replace(/[^\x20-\x7e]|["\\]/g, '_')
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

/**
 * Captured content is untrusted: `nosniff` keeps browsers on the declared type and the
 * `sandbox` CSP stops an HTML or SVG attachment opened inline from running scripts with the
 * app origin (and its session cookie).
 */
export function binaryResponse(
  data: Uint8Array,
  headers: { contentType: string; disposition: string },
): Response {
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': headers.contentType,
      'Content-Disposition': headers.disposition,
      'Content-Length': String(data.byteLength),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'Cache-Control': 'private, no-store',
    },
  })
}
