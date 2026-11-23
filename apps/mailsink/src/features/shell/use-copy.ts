import { useLingui } from '@lingui/react/macro'
import { useToast } from '@mailsink/ui'
import { useCallback } from 'react'

/**
 * Copies a text to the clipboard and confirms it with a toast (prototype: « Copié dans le
 * presse-papiers », or a more precise message such as « Snippet copied »).
 */
export function useCopy(): (text: string, done?: string) => Promise<void> {
  const { t } = useLingui()
  const toast = useToast()
  return useCallback(
    async (text, done) => {
      try {
        await navigator.clipboard.writeText(text)
        toast(done ?? t`Copied to the clipboard`)
      } catch {
        toast(t`Copy failed: the browser refused access to the clipboard`, { priority: 'high' })
      }
    },
    [toast, t],
  )
}
