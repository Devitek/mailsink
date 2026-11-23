import type { Chaos } from '@mailsink/contracts'
import type { Random } from '../simulation/rng'

export type ChaosSurface = 'http' | 'smtp'
export type ChaosHttpCode = Chaos['httpCodes'][number]
export type ChaosSmtpCode = Chaos['smtpCodes'][number]

type CodeOf<S extends ChaosSurface> = S extends 'http' ? ChaosHttpCode : ChaosSmtpCode

/**
 * Request-level chaos (#25): fails the request with probability `errorRate` percent, then
 * picks one code of the surface uniformly. Null when the request goes through. Two draws
 * from `random`, the second only on a hit.
 */
export function drawChaos<S extends ChaosSurface>(
  chaos: Chaos | null,
  surface: S,
  random: Random,
): CodeOf<S> | null {
  if (!chaos || chaos.errorRate <= 0) return null
  if (random() * 100 >= chaos.errorRate) return null
  const codes = (surface === 'http' ? chaos.httpCodes : chaos.smtpCodes) as CodeOf<S>[]
  return codes[Math.min(codes.length - 1, Math.floor(random() * codes.length))] ?? null
}
