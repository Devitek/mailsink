import { describe, expect, it } from 'vitest'
import { decideRecipient } from './decide'
import { drawLatency, drawStatus } from './draw'
import { hashSeed, recipientRandom, seededRandom } from './rng'
import { matchesGlob, matchRule } from './rules'

const fixed = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length] ?? 0
}

describe('seededRandom', () => {
  it('replays the same sequence for the same seed', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    const seq = [a(), a(), a()]
    expect([b(), b(), b()]).toEqual(seq)
    expect(seq.every((n) => n >= 0 && n < 1)).toBe(true)
    expect(seededRandom(43)()).not.toBe(seq[0])
  })

  it('derives independent recipient generators', () => {
    expect(recipientRandom(1, 'a@x.io', 0)()).toBe(recipientRandom(1, 'a@x.io', 0)())
    expect(recipientRandom(1, 'a@x.io', 0)()).not.toBe(recipientRandom(1, 'a@x.io', 1)())
    expect(hashSeed('a')).not.toBe(hashSeed('b'))
  })
})

describe('matchesGlob', () => {
  it.each([
    ['*+bounce@*', 'jane+bounce@example.com', true],
    ['*+bounce@*', 'jane@example.com', false],
    ['*@EXAMPLE.com', 'bob@example.com', true],
    ['a?c@x.io', 'abc@x.io', true],
    ['a?c@x.io', 'ac@x.io', false],
    ['a.c@x.io', 'abc@x.io', false],
    ['(x)+[y]@x.io', '(x)+[y]@x.io', true],
  ])('%s against %s -> %s', (glob, email, expected) => {
    expect(matchesGlob(glob, email)).toBe(expected)
  })

  it('takes the first matching rule', () => {
    const rules = [
      { match: '*@a.io', status: 'failed' as const },
      { match: '*', status: 'hard_bounce' as const },
    ]
    expect(matchRule(rules, 'x@a.io')?.status).toBe('failed')
    expect(matchRule(rules, 'x@b.io')?.status).toBe('hard_bounce')
    expect(matchRule([], 'x@b.io')).toBeUndefined()
  })
})

describe('drawStatus', () => {
  it('gives the remainder to delivered', () => {
    const rates = { hard_bounce: 10, deferred: 20 }
    expect(drawStatus(rates, fixed(0.1))).toBe('deferred')
    expect(drawStatus(rates, fixed(0.25))).toBe('hard_bounce')
    expect(drawStatus(rates, fixed(0.3))).toBe('delivered')
    expect(drawStatus({ delivered: 10 }, fixed(0.99))).toBe('delivered')
    expect(drawStatus({ failed: 100 }, fixed(0.9999))).toBe('failed')
    expect(drawStatus({ invalid: 100 }, fixed(0.9999))).toBe('invalid')
    expect(drawStatus({ failed: 10, invalid: 10 }, fixed(0.15))).toBe('invalid')
  })

  it('follows the rates over many seeded draws', () => {
    const random = seededRandom(7)
    const counts = new Map<string, number>()
    for (let i = 0; i < 10_000; i++) {
      const s = drawStatus({ hard_bounce: 30, complained: 10 }, random)
      counts.set(s, (counts.get(s) ?? 0) + 1)
    }
    expect(counts.get('hard_bounce')).toBeGreaterThan(2800)
    expect(counts.get('hard_bounce')).toBeLessThan(3200)
    expect(counts.get('complained')).toBeGreaterThan(850)
    expect(counts.get('delivered')).toBeGreaterThan(5800)
  })

  it('draws latencies within bounds, inclusive', () => {
    expect(drawLatency({ minMs: 100, maxMs: 200 }, fixed(0))).toBe(100)
    expect(drawLatency({ minMs: 100, maxMs: 200 }, fixed(0.99999))).toBe(200)
    expect(drawLatency({ minMs: 0, maxMs: 0 }, fixed(0.5))).toBe(0)
  })
})

describe('decideRecipient', () => {
  const settings = {
    rates: { hard_bounce: 100 },
    rules: [
      { match: '*+slow@*', delayMs: 5000 },
      { match: '*+spam@*', status: 'complained' as const, smtpCode: 550 },
    ],
    latency: { minMs: 10, maxMs: 10 },
  }

  it('lets a rule fix the status before the draw', () => {
    expect(decideRecipient(settings, 'a+spam@x.io', fixed(0.5))).toEqual({
      status: 'complained',
      source: 'rule',
      rule: '*+spam@*',
      reason: 'rule *+spam@*',
      delayMs: 10,
      smtpCode: 550,
    })
  })

  it('keeps the drawn status when a rule only sets a delay', () => {
    expect(decideRecipient(settings, 'a+slow@x.io', fixed(0.5))).toEqual({
      status: 'hard_bounce',
      source: 'rates',
      rule: '*+slow@*',
      delayMs: 5000,
    })
  })

  it('draws status and latency without a rule', () => {
    expect(decideRecipient(settings, 'a@x.io', fixed(0.5))).toEqual({
      status: 'hard_bounce',
      source: 'rates',
      delayMs: 10,
    })
  })
})
