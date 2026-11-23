import type { UpdateWorkspaceRequest } from '@mailsink/contracts'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { readSettingsFn, saveDefaultsFn } from '../../server-fns/settings-fns'

// Settings page data (#43): one query per workspace (defaults, connections, event catalog),
// prefetched by the route loader; saving the defaults refetches every view showing them.

export const settingsQuery = (slug: string) =>
  queryOptions({
    queryKey: ['settings', slug],
    queryFn: () => readSettingsFn({ data: { slug } }),
  })

export function useSaveDefaults(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: z.input<typeof UpdateWorkspaceRequest>) =>
      saveDefaultsFn({ data: { slug, patch } }),
    onSettled: () =>
      Promise.all(
        [
          ['settings', slug],
          ['connections', slug],
          ['workspace', slug],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
  })
}
