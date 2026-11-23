import type { Chaos, RateLimitSettings } from '@mailsink/contracts'
import { type ChaosHttpCode, type ChaosSmtpCode, type ChaosSurface, drawChaos } from '../chaos/draw'
import { chaosSmtpReply, type SmtpReply } from '../chaos/smtp-reply'
import type { Random } from '../simulation/rng'
import { rateLimitSmtpReply } from './smtp-reply'
import type { RateLimitDecision, RateLimiter } from './token-bucket'

export interface GuardInput<S extends ChaosSurface> {
  surface: S
  /** Bucket key (D7). */
  connectionId: string
  /** From the settings resolver: effective `rateLimit` (null = unlimited) and `chaos`. */
  settings: { rateLimit: RateLimitSettings | null; chaos: Chaos | null }
  limiter: RateLimiter
  random: Random
}

export type GuardRejection<S extends ChaosSurface> =
  | { reason: 'rate_limited' }
  | { reason: 'chaos_injected'; code: S extends 'http' ? ChaosHttpCode : ChaosSmtpCode }

export interface GuardVerdict<S extends ChaosSurface> {
  /** Null when no rate limit applies (no headers then). */
  rateLimit: RateLimitDecision | null
  /** Null: the request goes on to ingestion. */
  rejection: GuardRejection<S> | null
}

/**
 * Request-level checks of an ingestion call (04-sequence), shared by HTTP and SMTP (#31):
 * the rate limit first (a call refused by chaos still spends its token), then the chaos
 * draw. Nothing is stored either way.
 */
export function guardRequest<S extends ChaosSurface>(input: GuardInput<S>): GuardVerdict<S> {
  const { settings } = input
  const rateLimit = settings.rateLimit
    ? input.limiter.take(input.connectionId, settings.rateLimit)
    : null
  if (rateLimit && !rateLimit.allowed) return { rateLimit, rejection: { reason: 'rate_limited' } }
  const code = drawChaos(settings.chaos, input.surface, input.random)
  return {
    rateLimit,
    rejection: code === null ? null : { reason: 'chaos_injected', code },
  }
}

/** The SMTP reply of a rejected verdict, null when the command goes through. */
export function smtpGuardReply(verdict: GuardVerdict<'smtp'>): SmtpReply | null {
  const { rejection } = verdict
  if (!rejection) return null
  if (rejection.reason === 'chaos_injected') return chaosSmtpReply(rejection.code)
  return rateLimitSmtpReply(verdict.rateLimit as RateLimitDecision)
}
