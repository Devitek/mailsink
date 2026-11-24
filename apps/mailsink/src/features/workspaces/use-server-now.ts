import { useEffect, useState } from 'react'
import { useNow } from '../inbox/relative-time'
import { measureServerOffset } from './server-offset'

let probe: Promise<number> | undefined

/**
 * `useNow` on the server clock: the ephemeral countdown is computed against the server
 * expiry, so a browser clock a few minutes off would show a wrong time left. One probe per
 * page load; 0 until it answers, which is also what the server render used.
 */
export function useServerNow(tickMs: number): number {
  const now = useNow(tickMs)
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    let live = true
    probe ??= measureServerOffset()
    void probe.then((value) => {
      if (live) setOffset(value)
    })
    return () => {
      live = false
    }
  }, [])
  return now + offset
}
