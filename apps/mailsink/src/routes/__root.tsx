import { I18nProvider } from '@lingui/react'
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { type ReactNode, useMemo } from 'react'
import { createI18n, loadCatalog } from '../i18n/lingui'
import { getRequestLocale } from '../i18n/locale-fns'
import type { Locale } from '../i18n/locales'
import appCss from '../styles/app.css?url'
import { ThemeProvider, useTheme } from '../theme/theme-context'
import { getRequestTheme } from '../theme/theme-fns'
import { THEME_COLOR } from '../theme/themes'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Mailsink' },
      { name: 'description', content: 'Every email caught. None delivered.' },
      { property: 'og:title', content: 'Mailsink' },
      { property: 'og:description', content: 'Every email caught. None delivered.' },
      { property: 'og:image', content: '/og-image-1200x630.png' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/mark-32.png', sizes: '32x32', type: 'image/png' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon-180.png' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
    ],
  }),
  // Runs during SSR, so the server HTML is already localized and themed; its data is
  // dehydrated, so the client hydrates with the same catalog and theme without refetching.
  // The locale switcher calls router.invalidate() to run it again.
  loader: async () => {
    const [locale, theme] = await Promise.all([getRequestLocale(), getRequestTheme()])
    return { locale, theme, messages: await loadCatalog(locale) }
  },
  staleTime: Number.POSITIVE_INFINITY,
  component: RootComponent,
})

function RootComponent() {
  const { locale, theme, messages } = Route.useLoaderData()
  const i18n = useMemo(() => createI18n(locale, messages), [locale, messages])
  return (
    <I18nProvider i18n={i18n}>
      <ThemeProvider initialTheme={theme}>
        <RootDocument locale={locale}>
          <Outlet />
        </RootDocument>
      </ThemeProvider>
    </I18nProvider>
  )
}

function RootDocument({ locale, children }: Readonly<{ locale: Locale; children: ReactNode }>) {
  const { theme } = useTheme()
  return (
    <html lang={locale} data-theme={theme}>
      <head>
        <HeadContent />
        {/* Follows the theme chosen in the app, not the OS (B1-4). */}
        <meta name="theme-color" content={THEME_COLOR[theme]} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
