import { randomInt } from 'node:crypto'

/** A source of uniform numbers in [0, 1). */
export type Random = () => number

/** Mulberry32: a small, fast, seedable PRNG (32-bit state). Not for cryptography. */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** FNV-1a 32-bit hash of a string, to derive independent seeds from one message seed. */
export function hashSeed(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** A fresh random 32-bit seed (stored in the decision snapshot to replay a draw). */
export function randomSeed(): number {
  return randomInt(0, 2 ** 32 - 1)
}

/**
 * The generator of one recipient decision: the same seed, recipient and attempt always
 * draw the same numbers, whatever the order recipients are decided in.
 */
export function recipientRandom(seed: number, email: string, attempt: number): Random {
  return seededRandom(hashSeed(`${seed}|${email}|${attempt}`))
}
