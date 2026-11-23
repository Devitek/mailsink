import type { SimulatedStatus } from '@mailsink/contracts'
import { drawLatency, drawStatus } from './draw'
import type { Random } from './rng'
import { matchRule } from './rules'
import type { EffectiveSettings } from './settings-resolver'

export interface RecipientDecision {
  status: SimulatedStatus
  /** `rule` when a deterministic rule fixed the status, `rates` when it was drawn. */
  source: 'rule' | 'rates'
  /** Glob of the matched rule, if any (a rule may only set a delay). */
  rule?: string
  /** Delay between `sent` and the final status: the rule `delayMs`, else a latency draw. */
  delayMs: number
  smtpCode?: number
  /** `message_recipients.status_reason` and event `data.reason`. */
  reason?: string
}

/**
 * Decides one recipient: deterministic rules first (first match wins), then the weighted
 * draw for the status when the rule does not fix one. Two draws at most are taken from
 * `random`, always in the same order (status, then latency), so a seed replays exactly.
 */
export function decideRecipient(
  settings: Pick<EffectiveSettings, 'rates' | 'rules' | 'latency'>,
  email: string,
  random: Random,
): RecipientDecision {
  const rule = matchRule(settings.rules, email)
  const drawn = drawStatus(settings.rates, random)
  const latency = drawLatency(settings.latency, random)
  const decision: RecipientDecision = rule?.status
    ? { status: rule.status, source: 'rule', reason: `rule ${rule.match}`, delayMs: latency }
    : { status: drawn, source: 'rates', delayMs: latency }
  if (rule) {
    decision.rule = rule.match
    if (rule.delayMs !== undefined) decision.delayMs = rule.delayMs
    if (rule.smtpCode !== undefined) decision.smtpCode = rule.smtpCode
  }
  return decision
}
