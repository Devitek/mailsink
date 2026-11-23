import type { ListMessagesQuery } from '@mailsink/contracts'
import type { Database } from '@mailsink/db'
import { DomainError } from '../errors'
import type { EventBus } from '../events/bus'
import { listCapturedMessages, type MessagePage } from './service'

export interface WaitDeps {
  db: Database
  bus: EventBus
  /** Aborts the wait (client gone, shutdown). */
  signal?: AbortSignal
  now?: () => number
}

/**
 * `GET /capture/messages?wait=true` (03-contracts, « Capture »): answers the first page as
 * soon as at least one message matches, else 408 `wait_timeout` after `timeout` ms.
 * Without `since`, only messages created from the request on count. The bus subscription
 * is taken *before* the first query (04-sequence), so a message committed in between
 * still wakes the wait; every frame of the workspace triggers a new query (a status filter
 * may start matching after a simulation), coalesced while one is running.
 */
export async function waitForMessages(
  deps: WaitDeps,
  workspaceId: string,
  query: ListMessagesQuery,
): Promise<MessagePage> {
  const startedAt = (deps.now ?? Date.now)()
  const search = { ...query, since: query.since ?? new Date(startedAt).toISOString() }
  let dirty = true
  let gone = false
  // Wake-ups that land while a query runs are kept, never lost.
  let woken = false
  let resume: (() => void) | undefined
  const wake = () => {
    woken = true
    resume?.()
  }
  const off = deps.bus.subscribe(workspaceId, (frame) => {
    if (frame.event.type === 'workspace.deleted') gone = true
    dirty = true
    wake()
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  let expired = false
  const onAbort = () => wake()
  deps.signal?.addEventListener('abort', onAbort)
  try {
    timer = setTimeout(() => {
      expired = true
      wake()
    }, query.timeout)
    for (;;) {
      if (gone) throw new DomainError('not_found', 'Workspace not found')
      if (deps.signal?.aborted) throw new DomainError('wait_timeout', 'Wait aborted')
      if (dirty) {
        dirty = false
        const page = await listCapturedMessages(deps.db, workspaceId, search)
        if (page.data.length > 0) return page
      }
      if (expired) {
        throw new DomainError('wait_timeout', `No message matched within ${query.timeout} ms`)
      }
      if (!woken) {
        await new Promise<void>((resolve) => {
          resume = resolve
        })
        resume = undefined
      }
      woken = false
    }
  } finally {
    off()
    clearTimeout(timer)
    deps.signal?.removeEventListener('abort', onAbort)
  }
}
