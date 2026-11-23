// Open Graph and Twitter card tags of every page. Social crawlers ignore relative URLs, so
// og:url and og:image are built on MAILSINK_PUBLIC_URL (read during SSR, public-url-fns.ts).

const OG_IMAGE = { path: '/og-image-1200x630.png', width: 1200, height: 630 }
const TAGLINE = 'Every email caught. None delivered.'

/** `path` (leading slash) on `publicUrl` (no trailing slash); relative when unknown. */
export function absoluteUrl(publicUrl: string | undefined, path: string): string {
  return publicUrl ? `${publicUrl}${path}` : path
}

export function socialMeta(publicUrl: string | undefined, pathname: string) {
  return [
    { property: 'og:title', content: 'Mailsink' },
    { property: 'og:description', content: TAGLINE },
    { property: 'og:url', content: absoluteUrl(publicUrl, pathname) },
    { property: 'og:image', content: absoluteUrl(publicUrl, OG_IMAGE.path) },
    { property: 'og:image:width', content: String(OG_IMAGE.width) },
    { property: 'og:image:height', content: String(OG_IMAGE.height) },
    { name: 'twitter:card', content: 'summary_large_image' },
  ]
}
