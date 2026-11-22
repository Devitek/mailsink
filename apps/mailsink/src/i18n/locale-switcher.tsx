import { useLingui } from '@lingui/react/macro'
import { useRouter } from '@tanstack/react-router'
import { useId } from 'react'
import { setLocale } from './locale-fns'
import { isLocale, LOCALE_LABELS, LOCALES } from './locales'

// Minimal, unstyled switcher: design tokens and the final placement come with the
// design system. Changing the value stores the cookie, then reloads the root loader,
// which fetches the new catalog.
export function LocaleSwitcher() {
  const { i18n, t } = useLingui()
  const router = useRouter()
  const id = useId()

  async function onChange(value: string) {
    if (!isLocale(value)) return
    await setLocale({ data: value })
    await router.invalidate()
  }

  return (
    <div>
      <label htmlFor={id}>{t`Language`}</label>{' '}
      <select id={id} value={i18n.locale} onChange={(event) => onChange(event.target.value)}>
        {LOCALES.map((locale) => (
          <option key={locale} value={locale} lang={locale}>
            {LOCALE_LABELS[locale]}
          </option>
        ))}
      </select>
    </div>
  )
}
