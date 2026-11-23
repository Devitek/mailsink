import { describe, expect, it } from 'vitest'
import { safeRedirect } from './redirect'

describe('safeRedirect', () => {
  it('keeps a path of this app, with its search and hash', () => {
    expect(safeRedirect('/w/staging?m=msg_1#top')).toBe('/w/staging?m=msg_1#top')
    expect(safeRedirect('/')).toBe('/')
  })

  it('refuses anything that could leave the app or loop on the sign-in page', () => {
    for (const value of [
      undefined,
      '',
      'w/staging',
      '//evil.test',
      '/\\evil.test',
      'https://evil.test/',
      'javascript:alert(1)',
      '/login',
      '/login?redirect=/',
    ]) {
      expect(safeRedirect(value), String(value)).toBeUndefined()
    }
  })
})
