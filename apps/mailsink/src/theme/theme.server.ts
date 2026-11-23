import { startServer } from '../http/start-server'
import { resolveTheme, THEME_COOKIE, type Theme } from './themes'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

// Theme of the current request: the remembered choice, else light (B1-4).
export async function readRequestTheme(): Promise<Theme> {
  const { getCookie } = await startServer()
  return resolveTheme(getCookie(THEME_COOKIE))
}

// Same cookie policy as the locale: set server side, read only by the SSR render.
export async function writeThemeCookie(theme: Theme): Promise<void> {
  const { setCookie } = await startServer()
  setCookie(THEME_COOKIE, theme, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
    httpOnly: true,
  })
}
