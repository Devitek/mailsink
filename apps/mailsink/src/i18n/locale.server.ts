import { getCookie, getRequestHeader, setCookie } from '@tanstack/react-start/server'
import { LOCALE_COOKIE, type Locale } from './locales'
import { resolveLocale } from './resolve-locale'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

// Locale of the current request: cookie > Accept-Language > en (D18).
export function readRequestLocale(): Locale {
  return resolveLocale({
    cookie: getCookie(LOCALE_COOKIE),
    acceptLanguage: getRequestHeader('accept-language'),
  })
}

// Set server side so the next SSR render already uses it; the client never reads it,
// the active locale comes from the root loader.
export function writeLocaleCookie(locale: Locale): void {
  setCookie(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
    httpOnly: true,
  })
}
