import {
  guardRequest,
  loadEffectiveSettings,
  type Random,
  type RateLimiter,
  type SmtpReply,
  smtpGuardReply,
} from '@mailsink/core'
import type { Executor } from '@mailsink/db'
import type { SmtpUser } from './auth'

export interface GuardDeps {
  db: Executor
  limiter: RateLimiter
  random: Random
  log: Pick<Console, 'info'>
}

/** Reply when the authenticated connection was deleted since AUTH (closes the session). */
export const CONNECTION_GONE: SmtpReply = {
  responseCode: 421,
  message: '4.7.0 Connection no longer available',
}

/**
 * Request-level checks of one SMTP transaction, run on `MAIL FROM` (04-sequence, D92):
 * effective settings of the connection, then the rate limit (one token per transaction),
 * then the chaos draw. Null lets the transaction go on; a reply refuses it before any
 * byte of the message is read, and nothing is stored.
 */
export async function guardTransaction(deps: GuardDeps, user: SmtpUser): Promise<SmtpReply | null> {
  const settings = await loadEffectiveSettings(
    deps.db,
    user.workspaceId,
    user.connectionId,
    new Date(),
  )
  if (!settings) return CONNECTION_GONE
  const verdict = guardRequest({
    surface: 'smtp',
    connectionId: user.connectionId,
    settings,
    limiter: deps.limiter,
    random: deps.random,
  })
  if (verdict.rejection?.reason === 'chaos_injected') {
    deps.log.info(
      `[mailsink] chaos: SMTP MAIL FROM answered ${verdict.rejection.code} (connection ${user.connectionId}, errorCode=chaos_injected)`,
    )
  }
  return smtpGuardReply(verdict)
}
