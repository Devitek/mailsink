import type { ListSuppressionsResponse } from '@mailsink/contracts'
import {
  type InfiniteData,
  infiniteQueryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { listSuppressionsFn, removeSuppressionsFn } from '../../server-fns/suppressions-fns'

// Suppression list of a workspace (#42): server pages (keyset cursor) per address filter.
// Removing one address is optimistic; resetting the list empties every cached page.

export const suppressionsKey = (slug: string) => ['suppressions', slug] as const

export const suppressionsQuery = (slug: string, email: string | undefined) =>
  infiniteQueryOptions({
    queryKey: [...suppressionsKey(slug), { email: email ?? '' }] as const,
    queryFn: ({ pageParam }): Promise<ListSuppressionsResponse> =>
      listSuppressionsFn({ data: { slug, email, cursor: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

type Pages = InfiniteData<ListSuppressionsResponse, string | undefined>

/** Every cached page without the rows `keep` refuses. */
export function filterPages(data: Pages | undefined, keep: (email: string) => boolean) {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((p) => ({ ...p, data: p.data.filter((s) => keep(s.email)) })),
  }
}

export function useSuppressionMutations(slug: string) {
  const qc = useQueryClient()
  const key = suppressionsKey(slug)
  const optimistic = async (keep: (email: string) => boolean) => {
    await qc.cancelQueries({ queryKey: key })
    const previous = qc.getQueriesData<Pages>({ queryKey: key })
    qc.setQueriesData<Pages>({ queryKey: key }, (data) => filterPages(data, keep))
    return { previous }
  }
  const rollback = (_e: unknown, _v: unknown, context?: { previous: [unknown, unknown][] }) => {
    for (const [queryKey, data] of context?.previous ?? []) {
      qc.setQueryData(queryKey as readonly unknown[], data)
    }
  }
  const onSettled = () => qc.invalidateQueries({ queryKey: key })

  const removeOne = useMutation({
    mutationFn: (email: string) => removeSuppressionsFn({ data: { slug, email } }),
    onMutate: (email: string) => optimistic((e) => e !== email),
    onError: rollback,
    onSettled,
  })
  const resetAll = useMutation({
    mutationFn: () => removeSuppressionsFn({ data: { slug } }),
    onMutate: () => optimistic(() => false),
    onError: rollback,
    onSettled,
  })
  return { removeOne, resetAll }
}
