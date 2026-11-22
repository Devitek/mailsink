import type { StreamEventType } from '@mailsink/contracts'
import type { StreamFrame } from './bus'

export interface StreamFilter {
  connectionId?: string
  types?: readonly StreamEventType[]
}

/**
 * `GET /capture/stream` filters. `workspace.deleted` always passes (it closes the stream).
 * With `connectionId`, frames bound to another connection or to none (SMTP without
 * connection) are dropped; workspace-wide frames (purge, override) still pass.
 */
export function frameMatches(frame: StreamFrame, filter: StreamFilter): boolean {
  const { type } = frame.event
  if (type === 'workspace.deleted') return true
  if (filter.types?.length && !filter.types.includes(type)) return false
  if (!filter.connectionId) return true
  if (type === 'messages.purged' || type === 'override.changed') return true
  return frame.connectionId === filter.connectionId
}
