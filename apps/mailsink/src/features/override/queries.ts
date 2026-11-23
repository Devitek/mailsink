import type { ActivateOverrideRequest, OverrideState } from '@mailsink/contracts'
import { type QueryClient, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { applyOverrideFn, readOverrideFn, resetOverrideFn } from '../../server-fns/override-fns'
import type { OverridePanel } from '../../server-fns/override-types'
import { pendingView, type Scope, withoutScopes, withView } from './override-state'

// Override data of a workspace (#42): one query read by the header pill and the panel.
// Changes are optimistic (rolled back on failure) and the stream keeps the query live:
// every `override.changed` frame carries the whole new state.

export const overrideKey = (slug: string) => ['override', slug] as const

export const overrideQuery = (slug: string) =>
  queryOptions({
    queryKey: overrideKey(slug),
    queryFn: () => readOverrideFn({ data: { slug } }),
  })

/** Writes the state of an `override.changed` frame (or a mutation answer) in the cache. */
export function setOverrideState(qc: QueryClient, slug: string, state: OverrideState) {
  qc.setQueryData<OverridePanel | null>(overrideKey(slug), (data) =>
    data ? { ...data, state } : data,
  )
}

function useOptimistic<T>(slug: string, change: (state: OverrideState, input: T) => OverrideState) {
  const qc = useQueryClient()
  return {
    onMutate: async (input: T) => {
      await qc.cancelQueries({ queryKey: overrideKey(slug) })
      const previous = qc.getQueryData<OverridePanel | null>(overrideKey(slug))
      if (previous) setOverrideState(qc, slug, change(previous.state, input))
      return { previous }
    },
    onError: (_error: unknown, _input: T, context?: { previous?: OverridePanel | null }) => {
      if (context?.previous) qc.setQueryData(overrideKey(slug), context.previous)
    },
    onSuccess: (state: OverrideState) => setOverrideState(qc, slug, state),
  }
}

type Request = z.input<typeof ActivateOverrideRequest>

export function useOverrideMutations(slug: string) {
  const apply = useMutation({
    mutationFn: (request: Request) => applyOverrideFn({ data: { slug, request } }),
    ...useOptimistic<Request>(slug, (state, request) => withView(state, pendingView(request))),
  })
  const reset = useMutation({
    mutationFn: (scopes: Scope[]) => resetOverrideFn({ data: { slug, scopes } }),
    ...useOptimistic<Scope[]>(slug, withoutScopes),
  })
  return { apply, reset }
}
