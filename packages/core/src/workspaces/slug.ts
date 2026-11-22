import { randomBytes } from 'node:crypto'

const MAX_BASE = 56 // + "-" + 6 suffix characters = 63, the Slug maximum
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** Lower-case ASCII, words joined by `-`; `workspace` when nothing is left. */
export function slugify(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_BASE)
    .replace(/^-+|-+$/g, '')
  return base || 'workspace'
}

/** `<slugified name>-<6 random characters>`, used when the request gives no slug. */
export function generateSlug(name: string): string {
  const suffix = Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join('')
  return `${slugify(name)}-${suffix}`
}
