import { type I18n, type Messages, setupI18n } from '@lingui/core'
import type { Locale } from './locales'

// Dynamic import: each locale is its own chunk, compiled from the PO file by
// @lingui/vite-plugin, and only the active one is fetched by the browser.
export async function loadCatalog(locale: Locale): Promise<Messages> {
  const { messages } = await import(`../locales/${locale}/messages.po`)
  return messages
}

// One instance per render tree, never the global `i18n`: concurrent SSR requests may
// each use a different locale.
export function createI18n(locale: Locale, messages: Messages): I18n {
  return setupI18n({ locale, messages: { [locale]: messages } })
}
