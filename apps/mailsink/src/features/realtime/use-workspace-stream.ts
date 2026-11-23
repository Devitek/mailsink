import { type QueryKey, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { messagePreviewsFn } from '../../server-fns/messages-fns'
import { inboxKey } from '../inbox/queries'
import { inboxPaths } from '../inbox/ui-paths'
import { applyPreviews, applyStreamEvent } from './apply-stream-event'
import { connectStream, type StreamState } from './stream-connection'

/** Bursts (a batch send, a simulation run) are folded into one refetch per query. */
const COALESCE_MS = 250

/**
 * Real time of a workspace (#39): one EventSource on the session stream route feeding the
 * TanStack Query cache of the inbox. Returns the connection state (header indicator) and
 * whether the workspace was deleted meanwhile.
 */
export function useWorkspaceStream(slug: string): { state: StreamState; deleted: boolean } {
  const qc = useQueryClient()
  const [state, setState] = useState<StreamState>('connecting')
  const [deleted, setDeleted] = useState(false)

  useEffect(() => {
    const pendingKeys = new Map<string, QueryKey>()
    const pendingPreviews = new Set<string>()
    let timer: ReturnType<typeof setTimeout> | undefined

    const flush = () => {
      timer = undefined
      for (const queryKey of pendingKeys.values()) void qc.invalidateQueries({ queryKey })
      pendingKeys.clear()
      const ids = [...pendingPreviews].slice(0, 200)
      pendingPreviews.clear()
      if (ids.length) {
        messagePreviewsFn({ data: { slug, ids } })
          .then((previews) => applyPreviews(qc, slug, previews))
          .catch(() => {})
      }
    }
    const schedule = () => {
      timer ??= setTimeout(flush, COALESCE_MS)
    }

    setDeleted(false)
    const stop = connectStream({
      url: (lastEventId) => inboxPaths.stream(slug, lastEventId),
      onState: setState,
      onResync: () => void qc.invalidateQueries({ queryKey: inboxKey(slug) }),
      onEvent: (event) => {
        const effects = applyStreamEvent(qc, slug, event)
        for (const key of effects.invalidate) pendingKeys.set(JSON.stringify(key), key)
        for (const id of effects.previews) pendingPreviews.add(id)
        if (effects.deleted) {
          setDeleted(true)
          stop()
        }
        if (effects.invalidate.length || effects.previews.length) schedule()
      },
    })
    return () => {
      stop()
      clearTimeout(timer)
    }
  }, [qc, slug])

  return { state, deleted }
}
