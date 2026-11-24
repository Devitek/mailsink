import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The brand folder is the single source of the logo files (D274). The app serves copies
// from public/ at fixed URLs (`/favicon.svg`, manifest icons): each must stay identical to
// its source, so a brand update cannot leave a stale icon behind.
const BRAND = '../../../docs/design/brand-1/logo/'
const COPIES: Record<string, string> = {
  'favicon.svg': 'favicon.svg',
  'apple-touch-icon-180.png': 'png/apple-touch-icon-180.png',
  'mark-32.png': 'png/mark-32.png',
  'mark-512.png': 'png/mark-512.png',
  'maskable-192.png': 'png/maskable-192.png',
  'maskable-512.png': 'png/maskable-512.png',
}

describe('public brand assets', () => {
  it.each(Object.entries(COPIES))('public/%s is the brand file %s', (copy, source) => {
    const served = readFileSync(new URL(`../public/${copy}`, import.meta.url))
    const brand = readFileSync(new URL(`${BRAND}${source}`, import.meta.url))
    expect(served.equals(brand)).toBe(true)
  })
})
