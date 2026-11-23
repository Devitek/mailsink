import type { TemplateInputRaw, TemplatePatch } from '@mailsink/contracts'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import {
  createTemplateFn,
  deleteTemplateFn,
  listTemplatesFn,
  updateTemplateFn,
} from '../../server-fns/templates-fns'

// Brevo templates of the settings page (#43): one list per workspace, prefetched by the
// route loader on the templates section; every change refetches it.

export const templatesQuery = (slug: string) =>
  queryOptions({
    queryKey: ['templates', slug],
    queryFn: () => listTemplatesFn({ data: { slug } }),
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
