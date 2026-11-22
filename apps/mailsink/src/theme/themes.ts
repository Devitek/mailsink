// UI themes (B1-4): light by default, the user's choice is remembered in a cookie and
// applied during SSR as `data-theme` on <html>. prefers-color-scheme is not followed.
export const THEMES = ['light', 'dark'] as const

export type Theme = (typeof THEMES)[number]

export const DEFAULT_THEME: Theme = 'light'

export const THEME_COOKIE = 'mailsink_theme'

// Browser chrome colour per theme: --ms-bg of tokens.css. A <meta> needs a literal value.
export const THEME_COLOR: Record<Theme, string> = {
  light: '#f5f5f3',
  dark: '#0b0c0e',
}

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

export function resolveTheme(cookie: string | undefined): Theme {
  return isTheme(cookie) ? cookie : DEFAULT_THEME
}

export function nextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark'
}
