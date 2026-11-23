// Short relative times of the inbox rows (« 2 min », « 3 h », « 2 days »), localized by Intl.

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** null under a minute: the caller shows its own « now » text (translated by Lingui). */
export function formatRelative(iso: string, now: number, locale: string): string | null {
  const elapsed = Math.max(0, now - Date.parse(iso))
  if (elapsed < MINUTE) return null
  const unit = (value: number, name: 'minute' | 'hour' | 'day') =>
    new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'short' }).format(value)
  if (elapsed < HOUR) return unit(Math.floor(elapsed / MINUTE), 'minute')
  if (elapsed < DAY) return unit(Math.floor(elapsed / HOUR), 'hour')
  if (elapsed < 7 * DAY) return unit(Math.floor(elapsed / DAY), 'day')
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(iso))
}

/** « 22 Nov 2026, 14:32:08 »: the received date of the viewer, in the browser time zone. */
export function formatReceived(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(iso))
}

/** « 2.4 KB » (decimal units, as mail clients show attachment sizes). */
export function formatBytes(bytes: number, locale: string): string {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const
  let value = bytes
  let index = 0
  while (value >= 1000 && index < units.length - 1) {
    value /= 1000
    index += 1
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: units[index],
    unitDisplay: 'short',
    maximumFractionDigits: index === 0 ? 0 : 1,
  }).format(value)
}
