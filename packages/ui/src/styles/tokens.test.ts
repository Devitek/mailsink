import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { declarationsBySelector, referencedVariables } from './css-declarations'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const delivered = read('../../../../docs/design/brand-1/tokens/tokens.css')
const bundled = read('./tokens.css')
const extension = read('./tokens-ext.css')
const theme = read('./theme.css')

describe('tokens.css', () => {
  it('keeps the values of the brand delivery', () => {
    expect(declarationsBySelector(bundled)).toEqual(declarationsBySelector(delivered))
  })

  it('declares the brief 2 tokens (B2-5, B2-6)', () => {
    const root = declarationsBySelector(extension)[':root']
    expect(root?.['--ms-danger']).toBe('var(--ms-status-failed)')
    expect(root?.['--ms-control-h-xl']).toBe('44px')
  })
})

describe('theme.css', () => {
  // Every colour, radius and font of the delivery must reach Tailwind, so components never
  // need an arbitrary value.
  it('maps every colour, radius and font token', () => {
    const tokens = Object.keys({
      ...declarationsBySelector(bundled)[':root,[data-theme="light"]'],
      ...declarationsBySelector(bundled)[':root'],
    }).filter(
      (name) =>
        name.startsWith('--ms-') &&
        !/^--ms-(text-(display|title|heading|body|mono|label)|space-|header|list|focus|dur|ease)/.test(
          name,
        ),
    )
    const used = referencedVariables(theme)
    expect(tokens.length).toBeGreaterThan(20)
    expect(tokens.filter((name) => !used.has(name))).toEqual([])
  })

  it('aliases the shadcn variables with the accent split', () => {
    const aliases = declarationsBySelector(theme)[':root,[data-theme]']
    expect(aliases).toMatchObject({
      '--primary': 'var(--ms-accent)',
      '--primary-foreground': 'var(--ms-on-accent)',
      '--ring': 'var(--ms-accent-text)',
      '--destructive': 'var(--ms-danger)',
    })
  })

  it('hangs the dark variant on data-theme, not on prefers-color-scheme', () => {
    expect(theme).toContain(
      '@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))',
    )
    expect(theme).not.toContain('prefers-color-scheme')
  })
})
