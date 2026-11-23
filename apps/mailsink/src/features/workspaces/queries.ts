import { queryOptions } from '@tanstack/react-query'
import { listWorkspacesFn, openWorkspaceFn } from '../../server-fns/workspaces-fns'

// TanStack Query options of the workspace reads: route loaders prefetch them during SSR
// (ensureQueryData), the router integration dehydrates them, components read them back.

export const workspacesQuery = (ephemeral: boolean) =>
  queryOptions({
    queryKey: ['workspaces', { ephemeral }],
    queryFn: () => listWorkspacesFn({ data: { ephemeral } }),
  })

/** Opening a workspace touches its activity: never cached for long. */
export const workspaceQuery = (slug: string) =>
  queryOptions({
    queryKey: ['workspace', slug],
    queryFn: () => openWorkspaceFn({ data: { slug } }),
    staleTime: 0,
  })
