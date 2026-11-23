import type { TemplateInputRaw, TemplatePatch } from '@mailsink/contracts'
import { infiniteQueryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import {
  createTemplateFn,
  deleteTemplateFn,
  listTemplatesFn,
  updateTemplateFn,
} from '../../server-fns/templates-fns'

// Brevo templates of the settings page (#43): pages of 200 by `externalId` per workspace,
// the first prefetched by the route loader on the templates section, « Load more » for the
// next; every change refetches them.

export const templatesQuery = (slug: string) =>
  infiniteQueryOptions({
    queryKey: ['templates', slug],
    queryFn: ({ pageParam }) => listTemplatesFn({ data: { slug, cursor: pageParam } }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => (page.nextCursor === null ? undefined : Number(page.nextCursor)),
  })

export function useTemplateMutations(slug: string) {
  const queryClient = useQueryClient()
  const onSettled = () => queryClient.invalidateQueries({ queryKey: ['templates', slug] })
  const create = useMutation({
    mutationFn: (template: TemplateInputRaw) => createTemplateFn({ data: { slug, template } }),
    onSettled,
  })
  const update = useMutation({
    mutationFn: ({
      externalId,
      patch,
    }: {
      externalId: number
      patch: z.input<typeof TemplatePatch>
    }) => updateTemplateFn({ data: { slug, externalId, patch } }),
    onSettled,
  })
  const remove = useMutation({
    mutationFn: (externalId: number) => deleteTemplateFn({ data: { slug, externalId } }),
    onSettled,
  })
  return { create, update, remove }
}
