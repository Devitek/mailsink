import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { setTheme as persistTheme } from './theme-fns'
import { nextTheme, type Theme } from './themes'

type ThemeContextValue = { theme: Theme; toggleTheme: () => void }

const ThemeContext = createContext<ThemeContextValue | null>(null)

// `initialTheme` comes from the root loader (cookie read during SSR), so the server HTML
// already carries the right data-theme: no flash. Afterwards the client state is the source
// of truth: a toggle applies at once, the cookie is written in the background.
export function ThemeProvider({
  initialTheme,
  children,
}: Readonly<{ initialTheme: Theme; children: ReactNode }>) {
  const [theme, setThemeState] = useState(initialTheme)

  const toggleTheme = useCallback(() => {
    const next = nextTheme(theme)
    setThemeState(next)
    persistTheme({ data: next }).catch((error: unknown) => {
      console.error('Could not remember the theme choice', error)
    })
  }, [theme])

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])
  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>')
  return value
}
