import {
  type Executor,
  findSettingsLayers,
  findWebhookMessage,
  insertMessageEvents,
  lockMessage,
  type MessageEventRow,
  newId,
} from '@mailsink/db'
import { hashSeed, type Random, seededRandom } from '../simulation/rng'
import { resolveSettings } from '../simulation/settings-resolver'

export const ENGAGEMENT_USER_AGENT = 'Mozilla/5.0 (Mailsink simulation)'

export interface EngagementOptions {
  /** Generator of one recipient's draws; default: seeded by the message seed (D71). */
  random?: (email: string) => Random
}

/**
 * Automatic `opened` / `clicked` events (#34) for the recipients a simulation run just
 * delivered, drawn against the resolved `openRate` / `clickRate` (percent of delivered
 * recipients). A click needs a link of the message and implies an open. The events follow
 * `delivered` by 1 ms and 2 ms, origin `simulation`. Run inside a transaction: the message
 * row is locked while they are written.
 */
export async function recordEngagement(
  db: Executor,
  workspaceId: string,
  connectionId: string | null,
  delivered: readonly MessageEventRow[],
  options: EngagementOptions = {},
): Promise<MessageEventRow[]> {
  const first = delivered.find((e) => e.type === 'delivered')
  if (!first) return []
  const messageId = first.messageId
  // Overrides never carry openRate / clickRate (D73): the stored layers are enough.
  const layers = await findSettingsLayers(db, workspaceId, connectionId)
  if (!layers) return []
  const settings = resolveSettings({ ...layers, workspaceOverride: null, connectionOverride: null })
  if (settings.openRate <= 0 && settings.clickRate <= 0) return []
  const locked = await lockMessage(db, messageId)
  if (!locked || locked.workspaceId !== workspaceId) return []
  const message = await findWebhookMessage(db, workspaceId, messageId)
  if (!message) return []
  const seed = typeof locked.simulation?.seed === 'number' ? locked.simulation.seed : 0
  const rngOf =
    options.random ?? ((email: string) => seededRandom(hashSeed(`${seed}|${email}|engagement`)))

  const rows: MessageEventRow[] = []
  for (const event of delivered) {
    if (event.type !== 'delivered' || event.messageId !== messageId || !event.recipientEmail) {
      continue
    }
    const rng = rngOf(event.recipientEmail)
    let opened = rng() * 100 < settings.openRate
    const clicked = rng() * 100 < settings.clickRate && message.links.length > 0
    if (clicked) opened = true
    const at = event.occurredAt.getTime()
    const base = {
      workspaceId,
      messageId,
      recipientEmail: event.recipientEmail,
      origin: 'simulation' as const,
    }
    if (opened) {
      rows.push({
        ...base,
        id: newId('evt', at + 1),
        type: 'opened',
        data: { userAgent: ENGAGEMENT_USER_AGENT },
        occurredAt: new Date(at + 1),
      })
    }
    if (clicked) {
      const link = message.links[Math.floor(rng() * message.links.length)] ?? message.links[0]
      rows.push({
        ...base,
        id: newId('evt', at + 2),
        type: 'clicked',
        data: { url: link?.url, userAgent: ENGAGEMENT_USER_AGENT },
        occurredAt: new Date(at + 2),
      })
    }
  }
  await insertMessageEvents(db, rows)
  return rows
}
