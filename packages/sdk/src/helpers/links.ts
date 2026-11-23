/** The parts of a message the helpers read: a `MessageDetail` fits, so does a partial one. */
export interface MessageContent {
  subject?: string | null
  text?: string | null
  html?: string | null
  links?: readonly { url: string }[]
}

export type LinkMatcher = string | RegExp | ((url: URL) => boolean)

const HREF = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
const BARE_URL = /\bhttps?:\/\/[^\s<>"'`)\]]+/gi

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** Decodes the HTML entities found in attribute values (`&amp;`, `&#38;`, `&#x26;`). */
export function decodeEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] !== '#') return ENTITIES[name.toLowerCase()] ?? whole
    const code =
      name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1))
    return Number.isFinite(code) ? String.fromCodePoint(code) : whole
  })
}

/**
 * Every http(s) link of a message, in order of appearance and without duplicates: the
 * links the server extracted, then the `href`s of the HTML body, then the URLs of the
 * text body.
 */
export function extractLinks(message: MessageContent): string[] {
  const found: string[] = []
  for (const link of message.links ?? []) found.push(link.url)
  for (const match of (message.html ?? '').matchAll(HREF)) {
    found.push(decodeEntities((match[1] ?? match[2] ?? match[3] ?? '').trim()))
  }
  for (const match of (message.text ?? '').matchAll(BARE_URL)) {
    found.push(match[0].replace(/[.,;:!?]+$/, ''))
  }
  return [...new Set(found.filter((url) => /^https?:\/\//i.test(url)))]
}

/**
 * The first link matching: a substring of the URL, a RegExp tested on it, or a predicate
 * on the parsed URL. `null` when none does.
 */
export function findLink(message: MessageContent, matcher: LinkMatcher): string | null {
  for (const url of extractLinks(message)) {
    if (typeof matcher === 'string' && url.includes(matcher)) return url
    if (
      matcher instanceof RegExp &&
      new RegExp(matcher.source, matcher.flags.replace('g', '')).test(url)
    )
      return url
    if (typeof matcher === 'function') {
      const parsed = URL.canParse(url) ? new URL(url) : null
      if (parsed && matcher(parsed)) return url
    }
  }
  return null
}
