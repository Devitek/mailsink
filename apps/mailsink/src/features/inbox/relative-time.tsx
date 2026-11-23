import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import { formatReceived, formatRelative } from './format-relative'

const TICK_MS = 30_000

/**
 * One clock for every row: a re-render every 30 s keeps « 2 min » true; countdowns tick
 * every second (`tickMs`).
 */
export function useNow(tickMs = TICK_MS): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs)
    return () => clearInterval(id)
  }, [tickMs])
  return now
}

export function RelativeTime({ iso, now }: Readonly<{ iso: string; now: number }>) {
  const { i18n } = useLingui()
  const text = formatRelative(iso, now, i18n.locale)
  return (
    // The server and the browser clocks differ by the render delay.
    <time dateTime={iso} title={formatReceived(iso, i18n.locale)} suppressHydrationWarning>
      {text ?? <Trans>now</Trans>}
    </time>
  )
}
