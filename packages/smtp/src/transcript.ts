import { format } from 'node:util'
import type { TranscriptLine } from '@mailsink/db'

/** Lines kept per session; the following ones are counted, not stored. */
export const MAX_TRANSCRIPT_LINES = 500
/** Characters kept per line. */
export const MAX_LINE_LENGTH = 1000

const REDACTED = '/* secured */'

/**
 * Masks credentials a client line could carry. smtp-server already logs the AUTH argument
 * and every continuation line of an AUTH exchange as `/* secured *\/`; this is a backstop.
 */
export function redactClientLine(line: string): string {
  const auth = /^(AUTH\s+\S+)\s+(.+)$/i.exec(line)
  if (auth && auth[2] !== REDACTED) return `${auth[1]} ${REDACTED}`
  return line
}

type Entry = { tnx?: string; cid?: string }
type Session = { lines: TranscriptLine[]; dropped: number }

export interface TranscriptRecorder {
  /** bunyan-style logger handed to smtp-server (`logger` option). */
  logger: Record<
    'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    (...args: unknown[]) => void
  >
  /** Returns the transcript of a session and forgets it. */
  take(sessionId: string): TranscriptLine[]
}

/**
 * Builds session transcripts from the protocol log of smtp-server: client commands
 * (`tnx: 'command'`, `'data'`) and server replies (`tnx: 'send'`), keyed by session id.
 */
export function createTranscriptRecorder(now: () => number = Date.now): TranscriptRecorder {
  const sessions = new Map<string, Session>()

  function push(cid: string, dir: 'C' | 'S', text: string) {
    let session = sessions.get(cid)
    if (!session) {
      session = { lines: [], dropped: 0 }
      sessions.set(cid, session)
    }
    for (const raw of text.split(/\r?\n/)) {
      if (session.lines.length >= MAX_TRANSCRIPT_LINES) {
        session.dropped++
        continue
      }
      const line = dir === 'C' ? redactClientLine(raw) : raw
      session.lines.push({ at: now(), dir, line: line.slice(0, MAX_LINE_LENGTH) })
    }
  }

  function record(entry: unknown, message: unknown, ...args: unknown[]) {
    const { tnx, cid } = (entry ?? {}) as Entry
    if (!cid || typeof message !== 'string') return
    if (tnx !== 'command' && tnx !== 'data' && tnx !== 'send') return
    // Protocol lines start with `C:` or `S:`; other entries of these kinds are server notes.
    const prefix = /^([CS]):/.exec(message)
    if (!prefix) return
    const text = format(message, ...args).replace(/^[CS]: ?/, '')
    push(cid, prefix[1] as 'C' | 'S', text)
  }

  const ignore = () => {}
  return {
    logger: {
      trace: ignore,
      debug: record,
      info: record,
      warn: ignore,
      error: ignore,
      fatal: ignore,
    },
    take(sessionId) {
      const session = sessions.get(sessionId)
      sessions.delete(sessionId)
      if (!session) return []
      if (session.dropped === 0) return session.lines
      return [
        ...session.lines,
        { at: now(), dir: 'S', line: `[mailsink] ${session.dropped} more lines not recorded` },
      ]
    },
  }
}
