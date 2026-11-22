import { getCookie, setCookie } from '@tanstack/react-start/server'
import { resolveTheme, THEME_COOKIE, type Theme } from './themes'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

// Theme of the current request: the remembered choice, else light (B1-4).
export function readRequestTheme(): Theme {
  return resolveTheme(getCookie(THEME_COOKIE))
}

// Same cookie policy as the locale: set server side, read only by the SSR render.
export function writeThemeCookie(theme: Theme): void {
  setCookie(THEME_COOKIE, theme, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
    httpOnly: true,
  })
}
