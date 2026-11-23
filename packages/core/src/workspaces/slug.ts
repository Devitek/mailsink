import { randomBytes } from 'node:crypto'
import { slugify } from '@mailsink/contracts'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

// Shared with the web UI, which previews the slug as the name is typed (#38).
export { slugify }

/** `<slugified name>-<6 random characters>`, used when the request gives no slug. */
export function generateSlug(name: string): string {
  const suffix = Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join('')
  return `${slugify(name)}-${suffix}`
}
