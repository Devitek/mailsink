import { describe, expect, it } from 'vitest'
import { absoluteUrl, socialMeta } from './social-meta'

describe('socialMeta', () => {
  it('builds og:image and og:url as absolute URLs on the public URL', () => {
    expect(socialMeta('https://mail.example.com', '/w/staging')).toEqual([
      { property: 'og:title', content: 'Mailsink' },
      { property: 'og:description', content: 'Every email caught. None delivered.' },
      { property: 'og:url', content: 'https://mail.example.com/w/staging' },
      { property: 'og:image', content: 'https://mail.example.com/og-image-1200x630.png' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ])
  })

  it('keeps a path prefix of the public URL', () => {
    expect(absoluteUrl('https://example.com/mailsink', '/')).toBe('https://example.com/mailsink/')
    expect(absoluteUrl('https://example.com/mailsink', '/w/a')).toBe(
      'https://example.com/mailsink/w/a',
    )
  })

  it('falls back to relative URLs while the public URL is unknown', () => {
    expect(absoluteUrl(undefined, '/og-image-1200x630.png')).toBe('/og-image-1200x630.png')
  })
})
