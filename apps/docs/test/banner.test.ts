import { describe, expect, it } from 'vitest'
import { bannerContent, versionBanner } from '../src/banner'

describe('version banner (D271)', () => {
  it('links the latest release and its changelog', () => {
    const html = bannerContent('0.3.0')
    expect(html).toContain('href="https://github.com/Devitek/mailsink/releases/tag/v0.3.0"')
    expect(html).toContain('href="https://github.com/Devitek/mailsink/blob/v0.3.0/CHANGELOG.md"')
  })

  it('shows on every page but the landing page, and keeps a banner set by a page', () => {
    expect(versionBanner({ template: 'doc' }, '0.3.0')).toEqual({ content: bannerContent('0.3.0') })
    expect(versionBanner({}, '0.3.0')).toEqual({ content: bannerContent('0.3.0') })
    expect(versionBanner({ template: 'splash' }, '0.3.0')).toBeUndefined()
    expect(versionBanner({ banner: { content: 'Own' } }, '0.3.0')).toEqual({ content: 'Own' })
  })
})
