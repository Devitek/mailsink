import type { I18n, MessageDescriptor, Messages } from '@lingui/core'
import { createI18n } from '../i18n/lingui'
import { isLocale, type Locale } from '../i18n/locales'

// Localized `<title>` per page (proposition D183). A route head() is no React component, so
// it cannot use the I18nProvider: it translates with the catalog the root loader already
// loaded (its loaderData, visible to every head() through `matches`). The deepest title
// wins (HeadContent keeps the last one), so the root sets the bare product name.
//
//   head: ({ matches }) => ({ meta: [pageTitle(matches, msg`Sign in`)] })
//
// `msg` comes from `@lingui/core/macro`, so `pnpm i18n:extract` picks the string up.

export const APP_NAME = 'Mailsink'

type MatchLike = { routeId: string; loaderData?: unknown }
type RootData = { locale: Locale; messages: Messages }

const instances = new WeakMap<Messages, I18n>()

function isRootData(value: unknown): value is RootData {
  const data = value as Partial<RootData> | undefined
  return isLocale(data?.locale) && typeof data?.messages === 'object'
}

/** The i18n of the root loader (cached per catalog), undefined before it ran. */
export function headI18n(matches: readonly MatchLike[]): I18n | undefined {
  const data = matches.find((m) => m.routeId === '__root__')?.loaderData
  if (!isRootData(data)) return undefined
  let i18n = instances.get(data.messages)
  if (!i18n || i18n.locale !== data.locale) {
    i18n = createI18n(data.locale, data.messages)
    instances.set(data.messages, i18n)
  }
  return i18n
}

/** `Page · Mailsink`, or the bare name without a page. */
export function documentTitle(page?: string): string {
  return page ? `${page} · ${APP_NAME}` : APP_NAME
}

/** The `{ title }` meta entry of a page, translated in the locale of the request. */
export function pageTitle(
  matches: readonly MatchLike[],
  page: MessageDescriptor,
  values?: Record<string, unknown>,
): { title: string } {
  const i18n = headI18n(matches)
  const vars = values ?? page.values
  const text = i18n ? i18n._(page.id, vars, { message: page.message }) : (page.message ?? page.id)
  return { title: documentTitle(text) }
}
