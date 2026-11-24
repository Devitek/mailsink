import type { AddressInfo } from 'node:net'
import type { ActivityTracker, EventBus, Random, RateLimiter } from '@mailsink/core'
import type { Database } from '@mailsink/db'
import { SMTPServer } from 'smtp-server'
import { authenticate, type SmtpUser } from './auth'
import { type CredentialCache, createCredentialCache } from './credential-cache'
import { guardTransaction } from './guard'
import { ingestSmtpMessage, LOCAL_ERROR, readMessage, SmtpReplyError } from './on-data'
import { noopRecordSmtpSession, type RecordSmtpSession } from './session-record'
import { createSessionTracker } from './sessions'
import { createTranscriptRecorder } from './transcript'

export type SmtpLogger = Pick<Console, 'info' | 'warn' | 'error'>

export interface SmtpServerOptions {
  port: number
  host?: string
  db: Database
  /** Receives `message.created` once a message is committed (D6). */
  bus?: EventBus
  /** Touched after AUTH and on every transaction (D16). */
  activity?: Pick<ActivityTracker, 'touch'>
  rateLimiter: RateLimiter
  /** Chaos source, read at every draw (tests swap `runtime.chaosRandom`). */
  random: Random
  /** `MAILSINK_MAX_MESSAGE_BYTES`: advertised as `SIZE`, over it `552`. */
  maxMessageBytes: number
  /** PEM key and certificate: STARTTLS is offered only when set. */
  tls?: { key: string | Buffer; cert: string | Buffer }
  recordSmtpSession?: RecordSmtpSession
  credentialCache?: CredentialCache
  log?: SmtpLogger
  /** Max time to wait for open sessions on close (smtp-server defaults to 30 s). */
  closeTimeoutMs?: number
}

export interface SmtpServerHandle {
  /** Bound port (useful when `port: 0` asked for an ephemeral one). */
  port: number
  /** Stops accepting connections, then waits for the open sessions and their records. */
  close: () => Promise<void>
}

const fail = (reply: { responseCode: number; message: string }) => new SmtpReplyError(reply)

const AUTH_FAILED = { responseCode: 535, message: '5.7.8 Authentication credentials invalid' }

/** Starts the SMTP ingestion server (03-contracts « SMTP mapping »). Resolves once bound. */
export function startSmtpServer(options: SmtpServerOptions): Promise<SmtpServerHandle> {
  const { db, log = console } = options
  const cache = options.credentialCache ?? createCredentialCache()
  const transcripts = createTranscriptRecorder()
  const sessions = createSessionTracker({
    transcripts,
    record: options.recordSmtpSession ?? noopRecordSmtpSession,
    log,
  })
  const userOf = (session: { user?: unknown }) => session.user as SmtpUser | undefined

  const server = new SMTPServer({
    name: 'mailsink',
    banner: 'Mailsink',
    authMethods: ['PLAIN', 'LOGIN'],
    // A test sink: plain-text AUTH is allowed without STARTTLS (D131).
    allowInsecureAuth: true,
    disabledCommands: options.tls ? [] : ['STARTTLS'],
    ...(options.tls ? { key: options.tls.key, cert: options.tls.cert } : {}),
    size: options.maxMessageBytes,
    disableReverseLookup: true,
    logger: transcripts.logger,
    closeTimeout: options.closeTimeoutMs ?? 5_000,
    onConnect(session, callback) {
      sessions.open(session)
      callback()
    },
    onAuth(auth, session, callback) {
      const username = auth.username ?? ''
      sessions.authAttempt(session.id, username)
      authenticate(db, cache, username, auth.password ?? '')
        .then(async (user) => {
          if (!user) return callback(fail(AUTH_FAILED))
          sessions.authenticated(session.id, user)
          await options.activity?.touch(user.workspaceId)
          callback(null, { user })
        })
        .catch((error: unknown) => {
          log.error('[mailsink] smtp: AUTH failed', error)
          sessions.failed(session.id)
          callback(fail(LOCAL_ERROR))
        })
    },
    onMailFrom(_address, session, callback) {
      const user = userOf(session)
      if (!user) return callback(fail(AUTH_FAILED))
      const deps = { db, limiter: options.rateLimiter, random: options.random, log }
      guardTransaction(deps, user)
        .then(async (reply) => {
          if (reply) return callback(fail(reply))
          await options.activity?.touch(user.workspaceId)
          callback()
        })
        .catch((error: unknown) => {
          log.error('[mailsink] smtp: MAIL FROM failed', error)
          sessions.failed(session.id)
          callback(fail(LOCAL_ERROR))
        })
    },
    onData(stream, session, callback) {
      const user = userOf(session)
      const envelope = {
        mailFrom: session.envelope.mailFrom ? session.envelope.mailFrom.address : null,
        rcptTo: session.envelope.rcptTo.map((r) => r.address),
      }
      const work = readMessage(stream, options.maxMessageBytes).then((raw) => {
        if (!user) throw fail(AUTH_FAILED)
        return ingestSmtpMessage(
          { db, bus: options.bus, maxMessageBytes: options.maxMessageBytes },
          user,
          raw,
          envelope,
        )
      })
      sessions.track(
        session.id,
        work.then(
          (id) => {
            sessions.accepted(session.id, id)
            callback(null, `2.0.0 Ok: queued as ${id}`)
          },
          (error: unknown) => {
            if (error instanceof SmtpReplyError) return callback(error)
            log.error('[mailsink] smtp: DATA failed', error)
            sessions.failed(session.id)
            callback(fail(LOCAL_ERROR))
          },
        ),
      )
    },
    onClose(session) {
      void sessions.close(session)
    },
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port, options.host, () => {
      server.off('error', reject)
      server.on('error', (error) => log.warn(`[mailsink] smtp: ${error.message}`))
      const { port } = server.server.address() as AddressInfo
      resolve({
        port,
        close: async () => {
          await new Promise<void>((done) => server.close(() => done()))
          await sessions.drain()
        },
      })
    })
  })
}
