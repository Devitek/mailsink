export type QueryValue = string | number | boolean | Date | readonly string[] | null | undefined

/**
 * Query string of a call: `undefined` and `null` are left out, arrays are comma-separated
 * (every list filter of the API accepts it), dates are ISO 8601.
 */
export function toSearchParams(query: Record<string, QueryValue>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(name, value.join(','))
    } else if (value instanceof Date) params.set(name, value.toISOString())
    else params.set(name, String(value))
  }
  return params
}

/**
 * Query input type of a list route: every key optional (server defaults apply), and the
 * timestamps also accept a `Date`.
 */
export type QueryOf<T> = {
  [K in keyof T]?: K extends 'since' | 'until' | 'before' ? T[K] | Date : T[K]
}
