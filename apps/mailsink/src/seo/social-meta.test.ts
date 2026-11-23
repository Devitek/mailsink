import { describe, expect, it } from 'vitest'
import { absoluteUrl, ogImagePath, socialMeta } from './social-meta'

describe('socialMeta', () => {
  it('builds og:image and og:url as absolute URLs on the public URL', () => {
    expect(socialMeta('https://mail.example.com', '/w/staging', 'en')).toEqual([
      { property: 'og:title', content: 'Mailsink' },
      { property: 'og:description', content: 'Every email caught. None delivered.' },
      { property: 'og:url', content: 'https://mail.example.com/w/staging' },
      { property: 'og:locale', content: 'en_US' },
      { property: 'og:image', content: 'https://mail.example.com/og-image-en-1200x630.png' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ])
  })

  it('serves the French image to fr pages and the English one otherwise', () => {
    const fr = socialMeta('https://m.example', '/', 'fr')
    expect(fr).toContainEqual({ property: 'og:locale', content: 'fr_FR' })
    expect(fr).toContainEqual({
      property: 'og:image',
      content: 'https://m.example/og-image-fr-1200x630.png',
    })
    expect(ogImagePath(undefined)).toBe('/og-image-en-1200x630.png')
  })

  it('keeps a path prefix of the public URL', () => {
    expect(absoluteUrl('https://example.com/mailsink', '/')).toBe('https://example.com/mailsink/')
    expect(absoluteUrl('https://example.com/mailsink', '/w/a')).toBe(
      'https://example.com/mailsink/w/a',
    )
  })

  it('falls back to relative URLs while the public URL is unknown', () => {
    expect(absoluteUrl(undefined, '/og-image-en-1200x630.png')).toBe('/og-image-en-1200x630.png')
  })
})
