// Calendar days (`YYYY-MM-DD`) of the Brevo read routes, in the workspace timezone (D23,
// D284): the timezone Brevo writes its webhook dates in. An unknown zone falls back to UTC.

const DAY_MS = 86_400_000

function formatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return formatter('UTC')
  }
}

/** Offset of `timeZone` at `instant`, in ms (local wall clock minus UTC). */
function offsetAt(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(new Date(instant))
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>
  const wall = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return wall - Math.floor(instant / 1000) * 1000
}

/** Instant of 00:00 on `day` in `timeZone` (offset taken again after the first guess, DST). */
function zonedDayStart(day: string, timeZone: string): Date {
  const wall = Date.parse(`${day}T00:00:00Z`)
  const guess = wall - offsetAt(wall, timeZone)
  return new Date(wall - offsetAt(guess, timeZone))
}

const nextDay = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10)

/** `[since, until)` of an inclusive calendar day range in `timeZone`. */
export function zonedDayRange(startDate: string, endDate: string, timeZone: string) {
  return {
    since: zonedDayStart(startDate, timeZone),
    until: zonedDayStart(nextDay(endDate), timeZone),
  }
}

/** The current calendar day in `timeZone`. */
export function zonedToday(now: Date, timeZone: string): string {
  return new Date(now.getTime() + offsetAt(now.getTime(), timeZone)).toISOString().slice(0, 10)
}
