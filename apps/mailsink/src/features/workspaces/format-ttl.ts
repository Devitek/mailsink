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

const pad = (n: number) => String(n).padStart(2, '0')

/** Live countdown of the ephemeral banner (« 47m 12s », « 2h 01m 01s »), never negative. */
export function formatCountdown(expiresAt: string, now: number = Date.now()): string {
  const total = Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${m}m ${pad(s)}s`
}

/** An idle TTL in seconds, in the largest unit dividing it (« 1h », « 90m », « 2j »). */
export function formatTtl(seconds: number, locale: string): string {
  const ms = seconds * 1000
  const [unit, size] = UNITS.find(([, s]) => ms >= s && ms % s === 0) ?? ['minute', 60_000]
  return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'narrow' })
    .format(Math.round(ms / size))
    .replace(/\s/g, '')
}
