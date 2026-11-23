const UNITS = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
] as const

/**
 * Time left before an ephemeral workspace expires, short form of the prototype picker
 * (« 42m », « 2j »): the largest unit that fits, rounded up, in the UI locale (Intl, so no
 * catalog entry). Undefined without an expiry.
 */
export function formatTimeLeft(
  expiresAt: string | null,
  locale: string,
  now: number = Date.now(),
): string | undefined {
  if (!expiresAt) return
  const left = Math.max(0, Date.parse(expiresAt) - now)
  const [unit, size] = UNITS.find(([, ms]) => left >= ms) ?? ['minute', 60_000]
  const value = Math.ceil(left / size)
  return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'narrow' })
    .format(value)
    .replace(/\s/g, '')
}
