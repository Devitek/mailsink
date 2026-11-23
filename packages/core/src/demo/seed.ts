import type { DemoLocale, SeedDemoResponse } from '@mailsink/contracts'
import { type Connection, listConnections } from '@mailsink/db'
import type { StreamFrame } from '../events/bus'
import { publishAll } from '../events/bus'
import type { IngestDeps } from '../ingestion/native'
import type { IngestTarget } from '../ingestion/normalize'
import { persistEmails } from '../ingestion/pipeline'
import { prepareEmail } from '../ingestion/prepare'
import { demoMessages } from './catalog'
import { writeDemoLog } from './logs'

const MINUTE_MS = 60_000

/**
 * Targets of the demo messages: the enabled connections of the workspace in turn (each
 * message stored as sent through it, with its kind as source), or no connection at all
 * (native source) when the workspace has none.
 */
function targetsOf(workspaceId: string, connections: readonly Connection[]): IngestTarget[] {
  const enabled = connections.filter((c) => c.disabledAt === null)
  if (enabled.length === 0) return [{ workspaceId, connectionId: null, source: 'native' }]
  return enabled.map((c) => ({ workspaceId, connectionId: c.id, source: c.kind }))
}

/**
 * `POST /capture/demo` (#62): stores the demo data set in `workspaceId` through the normal
 * ingestion pipeline (blobs, raw EML, links, suppression check, simulation jobs, webhook
 * fan-out, stream frames). Each message carries its planned outcomes as a temporary rule
 * set (`messages.simulation.rules`), so the simulation gives the same varied statuses
 * whatever the workspace settings, without touching them or any override, and comes with
 * the log line of the request or SMTP session that would have sent it (#118). Seeding again
 * adds the set again (addresses bounced by the first run then come out `suppressed`).
 */
export async function seedDemoMessages(
  deps: IngestDeps,
  workspaceId: string,
  locale: DemoLocale,
  now: Date = new Date(),
): Promise<SeedDemoResponse> {
  const targets = targetsOf(workspaceId, await listConnections(deps.db, workspaceId))
  const messages = demoMessages(locale)
  const prepared = await Promise.all(
    messages.map(async (m) => ({
      ...(await prepareEmail(m.email, {
        maxMessageBytes: deps.maxMessageBytes,
        now: new Date(now.getTime() - m.minutesAgo * MINUTE_MS),
      })),
      simulation: { rules: m.rules },
    })),
  )
  const frames: StreamFrame[] = []
  const ids = await deps.db.transaction(async (tx) => {
    frames.length = 0 // a retried transaction starts over
    const stored: string[] = []
    for (const [i, item] of prepared.entries()) {
      const target = targets[i % targets.length] ?? {
        workspaceId,
        connectionId: null,
        source: 'native' as const,
      }
      const [message] = await persistEmails(tx, target, [item], { frames })
      if (!message) continue
      stored.push(message.id)
      const { email, createdAt } = item
      frames.push(await writeDemoLog(tx, { target, email, message, createdAt }))
    }
    return stored
  })
  publishAll(deps.bus, workspaceId, frames)
  return { count: ids.length, messageIds: ids }
}
