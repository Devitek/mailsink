import { decodeEntities, type MessageContent } from './links'

export interface ExtractCodeOptions {
  /** Digits of the code, default 6. Ignored with `pattern`. */
  length?: number
  /** Custom pattern; its first capture group is the code when it has one. */
  pattern?: RegExp
}

/** Visible text of an HTML body: no tags, scripts, styles nor entities. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html.replace(/<(script|style|head)\b[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<[^>]*>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The one-time code of a message (OTP): the first standalone run of `length` digits in the
 * subject, then the text body, then the visible text of the HTML body; or the first match
 * of `pattern`. `null` when there is none. URLs are skipped so ids in links do not match.
 */
export function extractCode(
  message: MessageContent,
  options: ExtractCodeOptions = {},
): string | null {
  const length = options.length ?? 6
  const pattern = options.pattern ?? new RegExp(`(?<![\\w-])(\\d{${length}})(?![\\w-])`)
  const sources = [message.subject, message.text, message.html ? htmlToText(message.html) : null]
  for (const source of sources) {
    if (!source) continue
    const match = new RegExp(pattern.source, pattern.flags.replace('g', '')).exec(
      source.replace(/\bhttps?:\/\/\S+/gi, ' '),
    )
    if (match) return match[1] ?? match[0]
  }
  return null
}
