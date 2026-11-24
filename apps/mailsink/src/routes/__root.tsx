import { I18nProvider } from '@lingui/react'
import { ToastProvider } from '@mailsink/ui'
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { type ReactNode, useEffect, useMemo } from 'react'
import { createI18n, loadCatalog } from '../i18n/lingui'
import { getRequestLocale } from '../i18n/locale-fns'
import type { Locale } from '../i18n/locales'
import type { RouterContext } from '../router'
import { documentTitle } from '../seo/page-title'
import { getPublicUrl } from '../seo/public-url-fns'
import { socialMeta } from '../seo/social-meta'
import { getInstanceInfo } from '../server-fns/instance-fns'
import appCss from '../styles/app.css?url'
import { ThemeProvider, useTheme } from '../theme/theme-context'
import { getRequestTheme } from '../theme/theme-fns'
import { THEME_COLOR } from '../theme/themes'

export const Route = createRootRouteWithContext<RouterContext>()({
  head: ({ loaderData, matches }) => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: documentTitle() },
      { name: 'description', content: 'Every email caught. None delivered.' },
      ...socialMeta(loaderData?.publicUrl, matches.at(-1)?.pathname ?? '/', loaderData?.locale),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/mark-32.png', sizes: '32x32', type: 'image/png' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon-180.png' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
    ],
  }),
  // Runs during SSR, so the server HTML is already localized, themed and carries absolute
  // Open Graph URLs (MAILSINK_PUBLIC_URL); its data is dehydrated, so the client hydrates
  // with the same catalog and theme without refetching. `instance` feeds the instance block
  // of the sign-in screen and of the « Language and session » menu.
  // Changing the locale calls router.invalidate() to run it again.
  loader: async () => {
    const [locale, theme, publicUrl, instance] = await Promise.all([
      getRequestLocale(),
      getRequestTheme(),
      getPublicUrl(),
      getInstanceInfo(),
    ])
    return { locale, theme, publicUrl, instance, messages: await loadCatalog(locale) }
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
          <ToastProvider>
            <Outlet />
          </ToastProvider>
        </RootDocument>
      </ThemeProvider>
    </I18nProvider>
  )
}

function RootDocument({ locale, children }: Readonly<{ locale: Locale; children: ReactNode }>) {
  const { theme } = useTheme()
  // `data-hydrated` on <html> once React owns the page: before that, a click lands on the
  // inert server HTML and is lost. The e2e helper `gotoHydrated` waits for it (D263).
  useEffect(() => {
    document.documentElement.dataset.hydrated = ''
  }, [])
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
