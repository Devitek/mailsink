// Supported UI locales (D17, D18). Keep in sync with `locales` in lingui.config.ts.
export const LOCALES = ['en', 'fr'] as const

export type Locale = (typeof LOCALES)[number]

// English is the source locale and the last-resort fallback.
export const SOURCE_LOCALE: Locale = 'en'

// Cookie holding the explicit user choice; it wins over Accept-Language.
export const LOCALE_COOKIE = 'mailsink_locale'

// Endonyms shown by the locale switcher: a language is always listed in its own name,
// so these labels are not translated.
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}
