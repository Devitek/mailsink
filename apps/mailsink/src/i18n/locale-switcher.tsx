import { useLingui } from '@lingui/react/macro'
import { useRouter } from '@tanstack/react-router'
import { useId } from 'react'
import { setLocale } from './locale-fns'
import { isLocale, LOCALE_LABELS, LOCALES } from './locales'

// Interim header switcher, styled as a 30 px control: the « Language and session » menu
// of brief 2 (B2-4) replaces it. Changing the value stores the cookie, then reloads the
// root loader, which fetches the new catalog. The label stays for assistive technologies.
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
      <label htmlFor={id} className="sr-only">
        {t`Language`}
      </label>
      <select
        id={id}
        value={i18n.locale}
        onChange={(event) => onChange(event.target.value)}
        className="h-control-md cursor-pointer rounded-md border border-ms-border bg-ms-raised px-2.5 text-sm text-ms-text outline-none transition-colors duration-fast hover:bg-ms-hover focus-visible:focus-ring"
      >
        {LOCALES.map((locale) => (
          <option key={locale} value={locale} lang={locale}>
            {LOCALE_LABELS[locale]}
          </option>
        ))}
      </select>
    </div>
  )
}
