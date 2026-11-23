import type { Chaos } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import type { Random } from '../simulation/rng'
import { drawChaos } from './draw'

/** Plays the given numbers in order. */
const sequence = (...values: number[]): Random => {
  let i = 0
  return () => values[i++] ?? 0
}

const chaos = (patch: Partial<Chaos>): Chaos => ({
  errorRate: 100,
  httpCodes: [500],
  smtpCodes: [451],
  ...patch,
})

describe('drawChaos', () => {
  it('passes without chaos or with a zero rate, without drawing', () => {
    const random = () => {
      throw new Error('no draw expected')
    }
    expect(drawChaos(null, 'http', random)).toBeNull()
    expect(drawChaos(chaos({ errorRate: 0 }), 'smtp', random)).toBeNull()
  })

  it('hits below errorRate and passes from it', () => {
    const settings = chaos({ errorRate: 25, httpCodes: [503] })
    expect(drawChaos(settings, 'http', sequence(0.2499, 0))).toBe(503)
    expect(drawChaos(settings, 'http', sequence(0.25))).toBeNull()
  })

  it('always hits at 100 percent and picks the code uniformly per surface', () => {
    const settings = chaos({ httpCodes: [429, 500, 502, 503], smtpCodes: [421, 550] })
    const draw = (surface: 'http' | 'smtp', pick: number) =>
      drawChaos(settings, surface, sequence(0.99, pick))
    expect([0, 0.25, 0.5, 0.99].map((p) => draw('http', p))).toEqual([429, 500, 502, 503])
    expect([0, 0.5].map((p) => draw('smtp', p))).toEqual([421, 550])
  })
})
