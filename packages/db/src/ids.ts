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
 * The UUIDv7 body starts with the 48-bit Unix time in milliseconds, so ids sort by creation;
 * ids generated in the same millisecond by this process keep their generation order.
 */
export function newId(prefix: IdPrefix, now: number = Date.now()): string {
  return `${prefix}_${uuidv7(now)}`
}

/**
 * RFC 9562 §6.2 method 1 (fixed-length dedicated counter): a 42-bit counter spans the 12 bits
 * of `rand_a` and the top 30 bits of `rand_b`. It is seeded at random (most significant bit
 * cleared, leaving room to increment) on a new millisecond, and incremented when the same
 * millisecond comes again. The last 32 bits stay random.
 */
const COUNTER_BITS = 42
const COUNTER_MAX = 2 ** COUNTER_BITS - 1
let lastMs = -1
let counter = 0

function nextCounter(now: number): number {
  if (now === lastMs && counter < COUNTER_MAX) return ++counter
  // New millisecond (or an exhausted counter, which needs 2^41 ids in one ms): fresh seed.
  lastMs = now
  counter = randomBytes(6).readUIntBE(0, 6) % 2 ** (COUNTER_BITS - 1)
  return counter
}

function uuidv7(now: number): string {
  const bytes = randomBytes(16)
  let ts = now
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ts % 256
    ts = Math.floor(ts / 256)
  }
  const count = nextCounter(now)
  const high = Math.floor(count / 2 ** 24) // top 18 bits
  const low = count % 2 ** 24 // bottom 24 bits
  bytes[6] = 0x70 | (high >>> 14) // version 7, counter bits 41-38
  bytes[7] = (high >>> 6) & 0xff
  bytes[8] = 0x80 | (high & 0x3f) // RFC 9562 variant, counter bits 29-24
  bytes[9] = low >>> 16
  bytes[10] = (low >>> 8) & 0xff
  bytes[11] = low & 0xff
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
