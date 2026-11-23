import { useCallback, useEffect, useState } from 'react'

// A boolean preference of this browser (localStorage). `undefined` until read on the
// client, so a caller can wait for it before loading anything it governs.
export function useStoredFlag(key: string): [boolean | undefined, (value: boolean) => void] {
  const [value, setValue] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    try {
      setValue(window.localStorage.getItem(key) === 'true')
    } catch {
      setValue(false)
    }
  }, [key])
  const store = useCallback(
    (next: boolean) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, String(next))
      } catch {
        // Private mode or storage full: the choice lasts for this page only.
      }
    },
    [key],
  )
  return [value, store]
}
