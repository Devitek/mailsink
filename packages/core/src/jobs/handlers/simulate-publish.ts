import { type Database, listMessageStreamEvents } from '@mailsink/db'
import { type EventBus, publishAll, type StreamFrame } from '../../events/bus'
import { framesOfRows, statusFrame } from '../../events/frames'
import type { SimulationResult } from '../../simulation/simulate-delivery'

export interface PublishSimulationOptions {
  /** Receives the events the simulation wrote and the aggregated status (D6). */
  bus?: EventBus
}

/**
 * Ids of the message events before the run, so the frames published after it are exactly
 * the rows the simulation wrote (the simulation result carries no event id). Skipped (no
 * query) while nobody listens to the workspace.
 */
export async function snapshotEventIds(
  db: Database,
  workspaceId: string,
  messageId: string,
  { bus }: PublishSimulationOptions,
): Promise<Set<string> | undefined> {
  if (!bus?.hasSubscribers(workspaceId)) return undefined
  return new Set((await listMessageStreamEvents(db, messageId)).map((e) => e.id))
}

/**
 * Publishes one `message.event` per row written by the run (`sent`, then the final status
 * of each recipient), then the aggregated `message.status`. A subscriber that arrived
 * during the run (no snapshot) still gets the aggregated status, enough to wake a
 * `wait=true` whose filter now matches.
 */
export async function publishSimulation(
  db: Database,
  workspaceId: string,
  messageId: string,
  result: SimulationResult,
  before: Set<string> | undefined,
  { bus }: PublishSimulationOptions,
): Promise<void> {
  if (!bus?.hasSubscribers(workspaceId) || result.kind !== 'done') return
  if (result.transitions.length === 0) return
  const rows = await listMessageStreamEvents(db, messageId)
  const frames: StreamFrame[] = before
    ? await framesOfRows(
        db,
        workspaceId,
        rows.filter((r) => !before.has(r.id)),
      )
    : []
  if (result.messageStatus) {
    frames.push(statusFrame(messageId, result.messageStatus, rows[0]?.connectionId ?? null))
  }
  publishAll(bus, workspaceId, frames)
}
