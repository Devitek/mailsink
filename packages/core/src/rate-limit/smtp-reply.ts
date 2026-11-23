import type { SmtpReply } from '../chaos/smtp-reply'
import type { RateLimitDecision } from './token-bucket'

/** `451 4.7.1 Rate limit exceeded, retry in Ns` (03-contracts « SMTP mapping »). */
export function rateLimitSmtpReply(decision: RateLimitDecision): SmtpReply {
  const seconds = decision.retryAfterSeconds ?? 1
  return { responseCode: 451, message: `4.7.1 Rate limit exceeded, retry in ${seconds}s` }
}
