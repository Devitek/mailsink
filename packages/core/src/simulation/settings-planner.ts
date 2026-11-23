import { decideRecipient } from './decide'
import { loadEffectiveSettings } from './load-settings'
import type { DeliveryPlanner } from './planner'
import { recipientRandom } from './rng'

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
  const outcomes = recipients.map((r) => {
    const d = decideRecipient(settings, r.email, recipientRandom(seed, r.email, r.attempt))
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
