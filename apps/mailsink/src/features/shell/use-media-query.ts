import { useCallback, useSyncExternalStore } from 'react'

/** Below the `md` breakpoint of the layout (768 px): the phone layouts. */
export const NARROW_QUERY = '(max-width: 767px)'

/**
 * Whether a CSS media query matches, kept live. The server renders the desktop layout
 * (false); the browser corrects it right after hydration.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}
