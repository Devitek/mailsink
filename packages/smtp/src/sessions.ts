import { newId } from '@mailsink/db'
import type { SMTPServerSession } from 'smtp-server'
import type { SmtpUser } from './auth'
import type { RecordSmtpSession, SmtpSessionOutcome, SmtpSessionRecord } from './session-record'
import type { TranscriptRecorder } from './transcript'

type State = {
  startedAt: Date
  user: SmtpUser | null
  authUser: string | null
  authFailed: boolean
  failed: boolean
  messageIds: string[]
  pending: Set<Promise<unknown>>
}

export interface SessionTrackerOptions {
  transcripts: TranscriptRecorder
  record: RecordSmtpSession
  log: Pick<Console, 'error'>
  now?: () => Date
}

/**
 * Outcome of a finished session (proposition D133): `accepted` once a message was stored,
 * else `error` after a server-side failure, else `auth_failed` when AUTH failed and never
 * succeeded, else `rejected` (a refused command, or no message at all).
 */
export function sessionOutcome(
  state: Pick<State, 'messageIds' | 'failed' | 'authFailed' | 'user'>,
): SmtpSessionOutcome {
  if (state.messageIds.length > 0) return 'accepted'
  if (state.failed) return 'error'
  if (state.authFailed && !state.user) return 'auth_failed'
  return 'rejected'
}

const lastError = (record: Pick<SmtpSessionRecord, 'transcript'>) =>
  record.transcript.findLast((l) => l.dir === 'S' && /^[45]\d\d[ -]/.test(l.line))?.line ?? null

/** Per-session state, turned into a `SmtpSessionRecord` when the connection closes. */
export function createSessionTracker(options: SessionTrackerOptions) {
  const { now = () => new Date() } = options
  const states = new Map<string, State>()
  const closing = new Set<Promise<void>>()
  const update = (id: string, change: (state: State) => void) => {
    const state = states.get(id)
    if (state) change(state)
  }

  async function finish(session: SMTPServerSession, state: State): Promise<void> {
    await Promise.allSettled(state.pending)
    const transcript = options.transcripts.take(session.id)
    const record: SmtpSessionRecord = {
      id: newId('smtp'),
      workspaceId: state.user?.workspaceId ?? null,
      connectionId: state.user?.connectionId ?? null,
      remoteAddress: session.remoteAddress,
      clientHostname: session.hostNameAppearsAs || null,
      authUser: state.authUser,
      secure: session.secure,
      transcript,
      messageIds: state.messageIds,
      outcome: sessionOutcome(state),
      error: null,
      startedAt: state.startedAt,
      endedAt: now(),
    }
    record.error = lastError(record)
    try {
      await options.record(record)
    } catch (error) {
      options.log.error('[mailsink] smtp: recording the session failed', error)
    }
  }

  return {
    open(session: SMTPServerSession) {
      states.set(session.id, {
        startedAt: now(),
        user: null,
        authUser: null,
        authFailed: false,
        failed: false,
        messageIds: [],
        pending: new Set(),
      })
    },
    authAttempt(id: string, username: string) {
      update(id, (s) => {
        s.authUser = username
        s.authFailed = true
      })
    },
    authenticated(id: string, user: SmtpUser) {
      update(id, (s) => {
        s.user = user
        s.authUser = user.username
        s.authFailed = false
      })
    },
    failed(id: string) {
      update(id, (s) => {
        s.failed = true
      })
    },
    accepted(id: string, messageId: string) {
      update(id, (s) => s.messageIds.push(messageId))
    },
    /** Work of a session that its record must wait for (a DATA still being stored). */
    track(id: string, work: Promise<unknown>) {
      const state = states.get(id)
      if (!state) return
      state.pending.add(work)
      work.finally(() => state.pending.delete(work)).catch(() => {})
    },
    close(session: SMTPServerSession): Promise<void> {
      const state = states.get(session.id)
      states.delete(session.id)
      if (!state) return Promise.resolve()
      const done = finish(session, state)
      closing.add(done)
      done.finally(() => closing.delete(done)).catch(() => {})
      return done
    },
    /** Waits for the records of the sessions already closed. */
    async drain() {
      await Promise.allSettled([...closing])
    },
  }
}
