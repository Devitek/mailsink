import { describe, expect, it } from 'vitest'
import { parseAcceptLanguage, resolveLocale } from './resolve-locale'

describe('parseAcceptLanguage', () => {
  it('returns an empty list for a missing or blank header', () => {
    expect(parseAcceptLanguage(undefined)).toEqual([])
    expect(parseAcceptLanguage('  ')).toEqual([])
  })

  it('orders tags by q-value, keeping header order on ties', () => {
    expect(parseAcceptLanguage('en;q=0.5, fr-FR, de;q=0.8, it')).toEqual([
      'fr-fr',
      'it',
      'de',
      'en',
    ])
  })

  it('drops tags with q=0 and malformed q-values', () => {
    expect(parseAcceptLanguage('fr;q=0, en;q=abc, de;q=0.3')).toEqual(['de'])
  })
})

describe('resolveLocale', () => {
  it('prefers a supported cookie over Accept-Language', () => {
    expect(resolveLocale({ cookie: 'fr', acceptLanguage: 'en' })).toBe('fr')
  })

  it('ignores an unsupported cookie', () => {
    expect(resolveLocale({ cookie: 'xx', acceptLanguage: 'fr' })).toBe('fr')
  })

  it('matches Accept-Language by primary subtag', () => {
    expect(resolveLocale({ acceptLanguage: 'fr-CA,fr;q=0.9,en;q=0.8' })).toBe('fr')
  })

  it('honours q-values when picking among supported languages', () => {
    expect(resolveLocale({ acceptLanguage: 'en;q=0.4, fr;q=0.9' })).toBe('fr')
  })

  it('skips unsupported languages until a supported one', () => {
    expect(resolveLocale({ acceptLanguage: 'de, ja;q=0.9, fr;q=0.1' })).toBe('fr')
  })

  it('falls back to en without any usable signal', () => {
    expect(resolveLocale({})).toBe('en')
    expect(resolveLocale({ acceptLanguage: 'de, *' })).toBe('en')
    expect(resolveLocale({ cookie: '', acceptLanguage: '' })).toBe('en')
  })
})
