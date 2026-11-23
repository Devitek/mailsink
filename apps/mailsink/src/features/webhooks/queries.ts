import type { WebhookEndpointInput, WebhookEndpointPatch } from '@mailsink/contracts'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import {
  createEndpointFn,
  deleteEndpointFn,
  listEndpointsFn,
  revealSecretFn,
  testEndpointFn,
  updateEndpointFn,
} from '../../server-fns/webhooks-fns'

// Webhook endpoints of the settings page (#43): one list per workspace, prefetched by the
// route loader on the webhooks section; every change refetches it.

export const endpointsQuery = (slug: string) =>
  queryOptions({
    queryKey: ['webhook-endpoints', slug],
    queryFn: () => listEndpointsFn({ data: { slug } }),
  })

export function useEndpointMutations(slug: string) {
  const queryClient = useQueryClient()
  const onSettled = () => queryClient.invalidateQueries({ queryKey: ['webhook-endpoints', slug] })

  const create = useMutation({
    mutationFn: (endpoint: z.input<typeof WebhookEndpointInput>) =>
      createEndpointFn({ data: { slug, endpoint } }),
    onSettled,
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: z.input<typeof WebhookEndpointPatch> }) =>
      updateEndpointFn({ data: { slug, id, patch } }),
    onSettled,
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteEndpointFn({ data: { slug, id } }),
    onSettled,
  })
  const test = useMutation({
    mutationFn: (id: string) => testEndpointFn({ data: { slug, id } }),
    onSettled,
  })
  const reveal = (id: string) => revealSecretFn({ data: { slug, id } })
  return { create, update, remove, test, reveal }
}
