export interface ExtractedLink {
  url: string
  text?: string
}

// The anchor body is bounded so an unclosed `<a>` cannot make the scan quadratic.
const ANCHOR_RE =
  /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]{0,4000}?)<\/a\s*>/gi
const TEXT_URL_RE = /\bhttps?:\/\/[^\s<>"'()]+/gi
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const MAX_LINKS = 500

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return ENTITIES[entity.toLowerCase()] ?? match
  })
}

const isHttp = (url: string) => /^https?:\/\//i.test(url)

/**
 * Links shown in the message view and used by click simulation: http(s) anchors of the html
 * (with their visible text), then bare http(s) urls of the text part, deduplicated by url.
 */
export function extractLinks(html: string | null, text: string | null): ExtractedLink[] {
  const found = new Map<string, ExtractedLink>()
  const add = (link: ExtractedLink) => {
    if (found.size < MAX_LINKS && !found.has(link.url)) found.set(link.url, link)
  }
  for (const match of html?.matchAll(ANCHOR_RE) ?? []) {
    const url = decodeEntities((match[1] ?? match[2] ?? match[3] ?? '').trim())
    if (!isHttp(url)) continue
    const label = decodeEntities((match[4] ?? '').replace(/<[^>]*>/g, ''))
      .replace(/\s+/g, ' ')
      .trim()
    add(label ? { url, text: label } : { url })
  }
  for (const match of text?.matchAll(TEXT_URL_RE) ?? []) {
    add({ url: match[0].replace(/[.,;:!?]+$/, '') })
  }
  return [...found.values()]
}
