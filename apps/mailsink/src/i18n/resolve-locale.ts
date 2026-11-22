import { isLocale, type Locale, SOURCE_LOCALE } from './locales'

type LocaleSignals = {
  cookie?: string | undefined
  acceptLanguage?: string | undefined
}

// Resolution order (D18): explicit cookie > Accept-Language > source locale.
export function resolveLocale({ cookie, acceptLanguage }: LocaleSignals): Locale {
  if (isLocale(cookie)) return cookie
  for (const tag of parseAcceptLanguage(acceptLanguage)) {
    const primary = tag.split('-')[0]
    if (isLocale(tag)) return tag
    if (isLocale(primary)) return primary
  }
  return SOURCE_LOCALE
}

// Lower-cased language tags sorted by descending q-value (stable on ties). Tags with
// q=0 or an unparsable q-value are dropped, as RFC 9110 makes q=0 mean "not acceptable".
export function parseAcceptLanguage(header: string | undefined): string[] {
  if (!header) return []
  const entries: { tag: string; q: number; index: number }[] = []
  header.split(',').forEach((part, index) => {
    const [rawTag, ...params] = part.trim().split(';')
    const tag = rawTag?.trim().toLowerCase()
    if (!tag) return
    const q = parseQuality(params)
    if (q > 0) entries.push({ tag, q, index })
  })
  return entries.sort((a, b) => b.q - a.q || a.index - b.index).map((entry) => entry.tag)
}

function parseQuality(params: string[]): number {
  const qParam = params.map((param) => param.trim()).find((param) => param.startsWith('q='))
  if (!qParam) return 1
  const value = qParam.slice(2)
  if (!/^(0(\.\d{0,3})?|1(\.0{0,3})?)$/.test(value)) return 0
  return Number(value)
}
