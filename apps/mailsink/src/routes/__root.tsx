import { I18nProvider } from '@lingui/react'
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { type ReactNode, useMemo } from 'react'
import { createI18n, loadCatalog } from '../i18n/lingui'
import { getRequestLocale } from '../i18n/locale-fns'
import type { Locale } from '../i18n/locales'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Mailsink' },
    ],
  }),
  // Runs during SSR, so the server HTML is already localized; its data is dehydrated, so
  // the client hydrates with the same catalog without refetching it. The locale switcher
  // calls router.invalidate() to run it again.
  loader: async () => {
    const locale = await getRequestLocale()
    return { locale, messages: await loadCatalog(locale) }
  },
  staleTime: Number.POSITIVE_INFINITY,
  component: RootComponent,
})

function RootComponent() {
  const { locale, messages } = Route.useLoaderData()
  const i18n = useMemo(() => createI18n(locale, messages), [locale, messages])
  return (
    <I18nProvider i18n={i18n}>
      <RootDocument locale={locale}>
        <Outlet />
      </RootDocument>
    </I18nProvider>
  )
}

function RootDocument({ locale, children }: Readonly<{ locale: Locale; children: ReactNode }>) {
  return (
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
