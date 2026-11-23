// One-line body preview of the inbox rows (#39): plain text, at most PREVIEW_LENGTH chars.

export const PREVIEW_LENGTH = 160

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
    if (name[0] === '#') {
      const code =
        name[1]?.toLowerCase() === 'x' ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1))
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match
    }
    return ENTITIES[name.toLowerCase()] ?? match
  })
}

/** Visible text of an HTML fragment: no head, style, script, comment nor tag. */
export function htmlToText(html: string): string {
  const withoutBlocks = html
    .replace(/<!--[\s\S]*?(-->|$)/g, ' ')
    .replace(/<(head|style|script|title)\b[\s\S]*?(<\/\1\s*>|$)/gi, ' ')
  return decodeEntities(withoutBlocks.replace(/<[^>]*(>|$)/g, ' '))
}

/** The preview of a body excerpt: whitespace collapsed, cut on PREVIEW_LENGTH characters. */
export function previewText(excerpt: { text: string | null; html: boolean }): string {
  if (!excerpt.text) return ''
  const plain = excerpt.html ? htmlToText(excerpt.text) : excerpt.text
  const line = plain.replace(/\s+/g, ' ').trim()
  return line.length > PREVIEW_LENGTH ? `${line.slice(0, PREVIEW_LENGTH - 1).trimEnd()}…` : line
}
