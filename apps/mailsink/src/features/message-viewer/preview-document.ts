import type { PreviewScheme } from '../inbox/ui-paths'

// HTML body of a captured message, served to the sandboxed preview iframe (#40).

/**
 * The download CSP (`sandbox; default-src 'none'`) plus what an email needs to render:
 * inline and remote styles, images (inline `cid:` parts become data: URLs) and fonts.
 * Scripts, frames, forms, plugins and connections stay forbidden.
 */
export const PREVIEW_CSP = [
  'sandbox',
  "default-src 'none'",
  "style-src 'unsafe-inline' https: http:",
  'img-src data: https: http:',
  'font-src data: https: http:',
].join('; ')

/** Inline images embedded as data: URLs, above that they show as broken images. */
export const INLINE_IMAGES_MAX_BYTES = 5 * 1024 * 1024

const normalizeCid = (cid: string) => cid.replace(/^<|>$/g, '').trim().toLowerCase()

/**
 * The document of the iframe: the colour scheme of the chosen background (light or dark
 * mail client), `<base target="_blank">` so that links leave the frame (and, without
 * `allow-popups`, go nowhere), `cid:` references replaced by the given data: URLs.
 */
export function previewDocument(
  html: string,
  options: { scheme: PreviewScheme; inline?: Record<string, string> },
): string {
  const inline = new Map(
    Object.entries(options.inline ?? {}).map(([cid, url]) => [normalizeCid(cid), url]),
  )
  const body = inline.size
    ? html.replace(/cid:([^"'\s)>]+)/gi, (match, cid: string) => {
        const url = inline.get(normalizeCid(decodeURIComponent(cid)))
        return url ?? match
      })
    : html
  const head = `<meta name="color-scheme" content="${options.scheme}"><base target="_blank">`
  for (const opening of [/<head\b[^>]*>/i, /<html\b[^>]*>/i, /<!doctype[^>]*>/i]) {
    const found = opening.exec(body)
    if (found) {
      const end = found.index + found[0].length
      return body.slice(0, end) + head + body.slice(end)
    }
  }
  return head + body
}

export function dataUrl(contentType: string, data: Uint8Array): string {
  return `data:${contentType};base64,${Buffer.from(data).toString('base64')}`
}
