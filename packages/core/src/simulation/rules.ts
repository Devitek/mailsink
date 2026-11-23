import type { RecipientRule } from '@mailsink/contracts'

const cache = new Map<string, RegExp>()

/**
 * Glob of a recipient rule as a case-insensitive, whole-address regular expression:
 * `*` matches any run of characters (`@` included), `?` exactly one, everything else is
 * literal. `*+bounce@*` matches `jane+bounce@example.com`.
 */
export function globToRegExp(glob: string): RegExp {
  let re = cache.get(glob)
  if (!re) {
    const body = [...glob]
      .map((c) => (c === '*' ? '.*' : c === '?' ? '.' : c.replace(/[.+^${}()|[\]\\/-]/g, '\\$&')))
      .join('')
    re = new RegExp(`^${body}$`, 'is')
    if (cache.size > 1000) cache.clear()
    cache.set(glob, re)
  }
  return re
}

export function matchesGlob(glob: string, email: string): boolean {
  return globToRegExp(glob).test(email)
}

/** First rule whose glob matches the address (rules are evaluated in order). */
export function matchRule(
  rules: readonly RecipientRule[],
  email: string,
): RecipientRule | undefined {
  return rules.find((rule) => matchesGlob(rule.match, email))
}
