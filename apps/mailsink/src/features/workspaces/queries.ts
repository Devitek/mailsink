import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { listWorkspacesFn, openWorkspaceFn } from '../../server-fns/workspaces-fns'

// TanStack Query options of the workspace reads: route loaders prefetch them during SSR
// (ensureQueryData), the router integration dehydrates them, components read them back.

/** One picker section (persistent or ephemeral workspaces), paged, optionally searched. */
export const workspacesQuery = (ephemeral: boolean, q = '') =>
  infiniteQueryOptions({
    queryKey: ['workspaces', { ephemeral, q }],
    queryFn: ({ pageParam }) =>
      listWorkspacesFn({ data: { ephemeral, q: q || undefined, cursor: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })

/** Opening a workspace touches its activity: never cached for long. */
export const workspaceQuery = (slug: string) =>
  queryOptions({
    queryKey: ['workspace', slug],
    queryFn: () => openWorkspaceFn({ data: { slug } }),
    staleTime: 0,
  })
