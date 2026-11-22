import { type Database, deleteExpiredWorkspaces } from '@mailsink/db'
import type { EventBus } from '../events/bus'
import { startWorker, type Worker } from '../jobs/worker'
import type { ActivityTracker } from './activity'

/** Ephemeral GC period (02-database-schema, « Key queries »). */
export const EPHEMERAL_GC_INTERVAL_MS = 30_000

export interface EphemeralGcOptions {
  db: Database
  bus?: EventBus
  /** Pending touches are written first, so recent activity is never collected. */
  activity?: ActivityTracker
  now?: () => number
}

/**
 * One GC pass: deletes the ephemeral workspaces past `expires_at` (everything they own
 * cascades), then publishes `workspace.deleted` on each one's channel so open SSE streams
 * (and later MCP sessions) close. Resolves with the deleted ids.
 */
export async function runEphemeralGc(options: EphemeralGcOptions): Promise<string[]> {
  await options.activity?.flush()
  const ids = await deleteExpiredWorkspaces(options.db, new Date((options.now ?? Date.now)()))
  for (const workspaceId of ids) {
    options.activity?.forget(workspaceId)
    options.bus?.publish(workspaceId, {
      id: null,
      connectionId: null,
      event: { type: 'workspace.deleted', workspaceId },
    })
  }
  return ids
}

export interface EphemeralGcSchedulerOptions extends EphemeralGcOptions {
  intervalMs?: number
  log?: Pick<Console, 'info' | 'error'>
}

/** Runs a GC pass every `intervalMs`, never two at once; `stop()` waits for the one in flight. */
export function startEphemeralGc(options: EphemeralGcSchedulerOptions): Worker {
  const log = options.log ?? console
  return startWorker({
    intervalMs: options.intervalMs ?? EPHEMERAL_GC_INTERVAL_MS,
    tick: async () => {
      const ids = await runEphemeralGc(options)
      if (ids.length > 0) log.info(`[mailsink] gc: deleted expired workspace(s) ${ids.join(', ')}`)
    },
    onError: (error) => log.error('[mailsink] ephemeral gc pass failed', error),
  })
}
