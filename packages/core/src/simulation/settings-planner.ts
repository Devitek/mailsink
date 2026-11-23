import { type RecipientRule, RecipientRules } from '@mailsink/contracts'
import { decideRecipient } from './decide'
import { loadEffectiveSettings } from './load-settings'
import type { DeliveryPlanner } from './planner'
import { recipientRandom } from './rng'

/**
 * Rules carried by the message itself (`messages.simulation.rules`, written at ingestion by
 * the demo seeder, #62): a temporary rule set that only this message sees, ahead of the
 * stored layers. Anything else there is ignored.
 */
export function messageRules(simulation: Record<string, unknown> | null): RecipientRule[] {
  const parsed = RecipientRules.safeParse(simulation?.rules)
  return parsed.success ? parsed.data : []
}

/**
 * Planner of #21: resolves the effective settings of the message connection (4 layers,
 * overrides active at decision time), then decides every recipient with its own seeded
 * generator (`seed`, address, attempt), rules before the weighted draw.
 */
export const settingsPlanner: DeliveryPlanner = async ({ message, recipients, seed, now }, db) => {
  const settings = await loadEffectiveSettings(
    db,
    message.workspaceId,
    message.connectionId,
    new Date(now),
  )
  if (!settings) return { outcomes: [] }
  const own = messageRules(message.simulation)
  const decided = own.length > 0 ? { ...settings, rules: [...own, ...settings.rules] } : settings
  const outcomes = recipients.map((r) => {
    const d = decideRecipient(decided, r.email, recipientRandom(seed, r.email, r.attempt))
    return {
      recipientId: r.id,
      status: d.status,
      reason: d.reason,
      delayMs: d.delayMs,
      smtpCode: d.smtpCode,
      detail: d.rule ? { source: d.source, rule: d.rule } : { source: d.source },
    }
  })
  return {
    outcomes,
    context: { overrideIds: settings.overrideIds, sources: settings.sources },
  }
}
