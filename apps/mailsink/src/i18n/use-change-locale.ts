import { useLingui } from '@lingui/react'
import { useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'
import { setLocale } from './locale-fns'
import { isLocale, type Locale } from './locales'

/**
 * Active locale and its setter: stores the cookie, then reloads the root loader, which
 * fetches the new catalog. No page reload: open menus and typed values stay as they are.
 */
export function useChangeLocale(): { locale: Locale; changeLocale: (value: string) => void } {
  const { i18n } = useLingui()
  const router = useRouter()
  const changeLocale = useCallback(
    async (value: string) => {
      if (!isLocale(value) || value === i18n.locale) return
      await setLocale({ data: value })
      await router.invalidate()
    },
    [i18n.locale, router],
  )
  return { locale: i18n.locale as Locale, changeLocale }
}
