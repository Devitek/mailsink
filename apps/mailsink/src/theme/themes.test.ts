import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, isTheme, nextTheme, resolveTheme } from './themes'

describe('resolveTheme', () => {
  it('is light without a remembered choice (B1-4)', () => {
    expect(DEFAULT_THEME).toBe('light')
    expect(resolveTheme(undefined)).toBe('light')
    expect(resolveTheme('')).toBe('light')
  })

  it('returns the remembered choice', () => {
    expect(resolveTheme('dark')).toBe('dark')
    expect(resolveTheme('light')).toBe('light')
  })

  it('ignores an unknown cookie value', () => {
    expect(resolveTheme('system')).toBe('light')
    expect(resolveTheme('DARK')).toBe('light')
  })
})

describe('isTheme', () => {
  it('accepts only light and dark', () => {
    expect(isTheme('dark')).toBe(true)
    expect(isTheme('auto')).toBe(false)
    expect(isTheme(1)).toBe(false)
  })
})

describe('nextTheme', () => {
  it('flips between light and dark', () => {
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('light')
  })
})
