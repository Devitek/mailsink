import type { TranscriptLine } from '@mailsink/db'

/** Outcome of a session, the `smtp_outcome` enum of the `smtp_sessions` table. */
export type SmtpSessionOutcome = 'accepted' | 'rejected' | 'auth_failed' | 'error'

/**
 * One finished SMTP session, shaped like an `smtp_sessions` row (02-database-schema) so the
 * logs writer (#35) can insert it as is. The transcript is capped and AUTH is redacted.
 */
export interface SmtpSessionRecord {
  /** `smtp_…` */
  id: string
  /** Null until AUTH succeeded. */
  workspaceId: string | null
  connectionId: string | null
  remoteAddress: string
  clientHostname: string | null
  /** The username of the successful AUTH, else of the last attempt; null without AUTH. */
  authUser: string | null
  /** True once the session runs over TLS (STARTTLS). */
  secure: boolean
  transcript: TranscriptLine[]
  /** Ids of the messages accepted during the session, in order. */
  messageIds: string[]
  outcome: SmtpSessionOutcome
  /** Last error reply sent by the server (code and text), if any. */
  error: string | null
  startedAt: Date
  endedAt: Date
}

/**
 * Receives every finished session, after the connection closed. Errors are logged and
 * never reach the client. The default does nothing until the logs lot (#35) plugs in.
 */
export type RecordSmtpSession = (record: SmtpSessionRecord) => void | Promise<void>

export const noopRecordSmtpSession: RecordSmtpSession = () => {}
