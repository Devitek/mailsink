import type { CreatedConnection, UpdateConnectionRequest } from '@mailsink/contracts'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createConnectionFn,
  deleteConnectionFn,
  listConnectionsFn,
  rotateConnectionFn,
  updateConnectionFn,
} from '../../server-fns/connections-fns'
import type { ConnectionValues } from './connection-form'
import { toConnectionInput } from './connection-form'

// Connections page data (#38): one query per workspace (settings + connections), prefetched
// by the route loader during SSR; every change refetches it.

export const connectionsQuery = (slug: string) =>
  queryOptions({
    queryKey: ['connections', slug],
    queryFn: () => listConnectionsFn({ data: { slug } }),
  })

export function useConnectionMutations(slug: string) {
  const queryClient = useQueryClient()
  const onSettled = () => queryClient.invalidateQueries({ queryKey: ['connections', slug] })

  const create = useMutation({
    mutationFn: (values: ConnectionValues) =>
      createConnectionFn({ data: { slug, connection: toConnectionInput(values) } }),
    onSettled,
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateConnectionRequest }) =>
      updateConnectionFn({ data: { slug, id, patch } }),
    onSettled,
  })
  const rotate = useMutation({
    mutationFn: (id: string): Promise<CreatedConnection> =>
      rotateConnectionFn({ data: { slug, id } }),
    onSettled,
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteConnectionFn({ data: { slug, id } }),
    onSettled,
  })
  return { create, update, rotate, remove }
}
