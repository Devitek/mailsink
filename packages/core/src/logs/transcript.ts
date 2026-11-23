import type { TranscriptLine } from '@mailsink/contracts'

/** Lines kept per session: the first half and the last half around an omission marker. */
export const TRANSCRIPT_MAX_LINES = 1_000
/** Characters kept per line. */
export const TRANSCRIPT_LINE_MAX_CHARS = 1_000

const REDACTED = '[redacted]'

/**
 * AUTH never reaches the database: `AUTH PLAIN <secret>` keeps its mechanism, and every
 * client line answering a `334` challenge (LOGIN user and password, PLAIN continuation)
 * is redacted. The SMTP server may redact already; doing it twice is harmless.
 */
export function redactTranscript(lines: readonly TranscriptLine[]): TranscriptLine[] {
  let challenged = false
  return lines.map((entry) => {
    if (entry.dir === 'S') {
      challenged = /^334(\s|$)/.test(entry.line)
      return entry
    }
    if (challenged) {
      challenged = false
      return { ...entry, line: REDACTED }
    }
    const auth = /^(AUTH\s+\S+)\s+\S/i.exec(entry.line)
    return auth ? { ...entry, line: `${auth[1]} ${REDACTED}` } : entry
  })
}

function capLine(entry: TranscriptLine): TranscriptLine {
  if (entry.line.length <= TRANSCRIPT_LINE_MAX_CHARS) return entry
  const kept = entry.line.slice(0, TRANSCRIPT_LINE_MAX_CHARS)
  return { ...entry, line: `${kept}[… ${entry.line.length - kept.length} chars omitted]` }
}

/** Redacted, each line bounded, at most TRANSCRIPT_MAX_LINES lines (marker included). */
export function capTranscript(
  lines: readonly TranscriptLine[],
  maxLines = TRANSCRIPT_MAX_LINES,
): TranscriptLine[] {
  const redacted = redactTranscript(lines).map(capLine)
  if (redacted.length <= maxLines) return redacted
  const head = Math.ceil((maxLines - 1) / 2)
  const tail = maxLines - 1 - head
  const omitted = redacted.length - head - tail
  const marker: TranscriptLine = {
    at: redacted[head]?.at ?? 0,
    dir: 'S',
    line: `[… ${omitted} lines omitted]`,
  }
  return [...redacted.slice(0, head), marker, ...redacted.slice(redacted.length - tail)]
}
