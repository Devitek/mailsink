import { useEffect, useRef, useState } from 'react'

const secondsLeft = (until: number) => Math.max(0, Math.ceil((until - Date.now()) / 1000))

/**
 * Seconds left until `until` (epoch ms), refreshed live; calls `onDone` once at zero
 * (L1e: everything is re-enabled without a reload). 0 when `until` is null.
 */
export function useCountdown(until: number | null, onDone: () => void): number {
  const [left, setLeft] = useState(() => (until === null ? 0 : secondsLeft(until)))
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    if (until === null) {
      setLeft(0)
      return
    }
    const tick = () => {
      const next = secondsLeft(until)
      setLeft(next)
      if (next === 0) {
        clearInterval(timer)
        done.current()
      }
    }
    const timer = setInterval(tick, 250)
    tick()
    return () => clearInterval(timer)
  }, [until])

  return left
}
