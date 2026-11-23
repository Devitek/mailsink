import type { Locale } from '../i18n/locales'

// Open Graph and Twitter card tags of every page. Social crawlers ignore relative URLs, so
// og:url and og:image are built on MAILSINK_PUBLIC_URL (read during SSR, public-url-fns.ts).
// The image follows the locale of the page: French for fr, English for any other locale
// (#36, images versioned in docs/design/og/).

const OG_SIZE = { width: 1200, height: 630 }
const TAGLINE = 'Every email caught. None delivered.'
const OG_LOCALE: Record<Locale, string> = { en: 'en_US', fr: 'fr_FR' }

/** `path` (leading slash) on `publicUrl` (no trailing slash); relative when unknown. */
export function absoluteUrl(publicUrl: string | undefined, path: string): string {
  return publicUrl ? `${publicUrl}${path}` : path
}

/** Path of the Open Graph image of a locale (only FR and EN are drawn). */
export function ogImagePath(locale: Locale | undefined): string {
  const variant = locale === 'fr' ? 'fr' : 'en'
  return `/og-image-${variant}-${OG_SIZE.width}x${OG_SIZE.height}.png`
}

export function socialMeta(
  publicUrl: string | undefined,
  pathname: string,
  locale: Locale | undefined,
) {
  return [
    { property: 'og:title', content: 'Mailsink' },
    { property: 'og:description', content: TAGLINE },
    { property: 'og:url', content: absoluteUrl(publicUrl, pathname) },
    { property: 'og:locale', content: OG_LOCALE[locale ?? 'en'] },
    { property: 'og:image', content: absoluteUrl(publicUrl, ogImagePath(locale)) },
    { property: 'og:image:width', content: String(OG_SIZE.width) },
    { property: 'og:image:height', content: String(OG_SIZE.height) },
    { name: 'twitter:card', content: 'summary_large_image' },
  ]
}
