import { randomBytes } from 'node:crypto'

/** Known id prefixes (D25). Free strings are accepted for forward compatibility. */
export type IdPrefix =
  | 'ws'
  | 'con'
  | 'key'
  | 'ovr'
  | 'tpl'
  | 'blob'
  | 'msg'
  | 'rcp'
  | 'att'
  | 'evt'
  | 'sup'
  | 'whe'
  | 'whd'
  | 'wha'
  | 'req'
  | 'smtp'
  | (string & {})

/**
 * Prefixed, time-sortable identifier: `<prefix>_<uuidv7>` (D25).
 * The UUIDv7 body starts with the 48-bit Unix time in milliseconds, so ids sort by creation.
 */
export function newId(prefix: IdPrefix, now: number = Date.now()): string {
  return `${prefix}_${uuidv7(now)}`
}

function uuidv7(now: number): string {
  const bytes = randomBytes(16)
  let ts = now
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ts % 256
    ts = Math.floor(ts / 256)
  }
  bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f) // version 7
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f) // RFC 9562 variant
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
