import type { SmtpOutcome, TranscriptLine } from '@mailsink/contracts'
import { type Database, insertApiLog, insertSmtpSession, type NewApiLog, newId } from '@mailsink/db'
import type { EventBus } from '../events/bus'
import { capTranscript } from './transcript'
import { toApiLogSummary, toSmtpSessionSummary } from './views'

/**
 * One finished SMTP session, as the SMTP server reports it (`recordSmtpSession` hook of
 * packages/smtp). `workspaceId` and `connectionId` are known once AUTH resolved them.
 */
export interface SmtpSessionRecord {
  workspaceId?: string | null
  connectionId?: string | null
  remoteAddress: string
  clientHostname?: string | null
  authUser?: string | null
  secure: boolean
  transcript: readonly TranscriptLine[]
  messageIds: readonly string[]
  outcome: SmtpOutcome
  error?: string | null
  startedAt: Date
  endedAt: Date
}

export type ApiLogEntry = Omit<NewApiLog, 'id' | 'createdAt'> & { id: string; createdAt?: Date }

/**
 * Asynchronous writer of `api_logs` and `smtp_sessions` (#35). A write never fails the
 * caller: errors are logged. Each written row of a workspace publishes `log.api` or
 * `log.smtp` on its channel (derived frames: no SSE id, never replayed).
 */
export interface LogWriter {
  /** Queues the row (or the promise of it, bodies being read); returns at once. */
  writeApiLog(entry: ApiLogEntry | Promise<ApiLogEntry>): void
  /** Resolves once the session is stored (or its failure logged); never rejects. */
  recordSmtpSession(session: SmtpSessionRecord): Promise<void>
  /** Resolves once every write queued so far settled (runtime stop, tests). */
  flush(): Promise<void>
}

export interface LogWriterOptions {
  db: Database
  bus?: EventBus
  log?: Pick<Console, 'error'>
}

const ERROR_MAX_CHARS = 2_000

/** Postgres error code of a (possibly wrapped) driver error. */
function pgCode(error: unknown): string | undefined {
  let current: unknown = error
  while (current && typeof current === 'object') {
    if ('code' in current && typeof current.code === 'string') return current.code
    current = 'cause' in current ? current.cause : undefined
  }
  return undefined
}

// 23503: the workspace or connection was deleted meanwhile (ephemeral GC, Admin DELETE);
// its logs would have been deleted with it, so the row is dropped silently.
const FOREIGN_KEY_VIOLATION = '23503'

export function createLogWriter({ db, bus, log = console }: LogWriterOptions): LogWriter {
  const pending = new Set<Promise<void>>()
  const track = (label: string, work: () => Promise<void>): Promise<void> => {
    const run = work().catch((error: unknown) => {
      if (pgCode(error) === FOREIGN_KEY_VIOLATION) return
      log.error(`[mailsink] logs: could not write ${label}`, error)
    })
    pending.add(run)
    run.finally(() => pending.delete(run))
    return run
  }

  return {
    writeApiLog(entry) {
      void track('api log', async () => {
        const row = await insertApiLog(db, await entry)
        if (!row.workspaceId || !bus?.hasSubscribers(row.workspaceId)) return
        bus.publish(row.workspaceId, {
          id: null,
          connectionId: row.connectionId,
          event: { type: 'log.api', log: toApiLogSummary(row) },
        })
      })
    },
    recordSmtpSession(session) {
      const id = newId('smtp')
      return track(`smtp session ${id}`, async () => {
        const row = await insertSmtpSession(db, {
          id,
          workspaceId: session.workspaceId ?? null,
          connectionId: session.connectionId ?? null,
          remoteAddress: session.remoteAddress,
          clientHostname: session.clientHostname ?? null,
          authUser: session.authUser ?? null,
          secure: session.secure,
          transcript: capTranscript(session.transcript),
          messageIds: [...session.messageIds],
          outcome: session.outcome,
          error: session.error?.slice(0, ERROR_MAX_CHARS) ?? null,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
        })
        if (!row.workspaceId || !bus?.hasSubscribers(row.workspaceId)) return
        bus.publish(row.workspaceId, {
          id: null,
          connectionId: row.connectionId,
          event: { type: 'log.smtp', session: toSmtpSessionSummary(row) },
        })
      })
    },
    async flush() {
      while (pending.size > 0) await Promise.all([...pending])
    },
  }
}
