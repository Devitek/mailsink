import { MailsinkError } from '@devitek/mailsink'
import { describe, expect, it } from 'vitest'
import { buildConfig } from '../src/commands/override'
import { describeFailure, EXIT, UsageError } from '../src/errors'
import { envLines, table } from '../src/output'
import {
  parseConnection,
  parseDurationMs,
  parseDurationSeconds,
  parseLatency,
  parsePercent,
  parseRule,
  parseSince,
} from '../src/parse'

describe('option parsers', () => {
  it('reads durations, a bare number being seconds', () => {
    expect(parseDurationMs('500ms', 'timeout')).toBe(500)
    expect(parseDurationMs('5s', 'timeout')).toBe(5_000)
    expect(parseDurationMs('1.5', 'timeout')).toBe(1_500)
    expect(parseDurationMs('2m', 'timeout')).toBe(120_000)
    expect(parseDurationSeconds('1h', 'ttl')).toBe(3_600)
    expect(() => parseDurationMs('soon', 'timeout')).toThrow(/--timeout/)
    expect(() => parseDurationSeconds('1500ms', 'ttl')).toThrow(UsageError)
  })

  it('reads percentages, latencies, connections and rules', () => {
    expect(parsePercent('20%', 'hard-bounce')).toBe(20)
    expect(() => parsePercent('120', 'hard-bounce')).toThrow(/--hard-bounce/)
    expect(() => parsePercent('', 'hard-bounce')).toThrow(UsageError)
    expect(parseLatency('100-500')).toEqual({ minMs: 100, maxMs: 500 })
    expect(parseLatency('200')).toEqual({ minMs: 200, maxMs: 200 })
    expect(() => parseLatency('500-100')).toThrow(/--latency/)
    expect(parseConnection('resend:app')).toEqual({ kind: 'resend', name: 'app' })
    expect(parseConnection('smtp')).toEqual({ kind: 'smtp', name: 'smtp' })
    expect(() => parseConnection('mailgun:app')).toThrow(/--connection/)
    expect(parseRule('*+bounce@*=hard_bounce')).toEqual({
      match: '*+bounce@*',
      status: 'hard_bounce',
    })
    expect(() => parseRule('hard_bounce')).toThrow(/--rule/)
  })

  it('reads --since as a date, now or a duration ago, the epoch by default', () => {
    const now = new Date('2026-01-01T12:00:00Z')
    expect(parseSince(undefined, now).getTime()).toBe(0)
    expect(parseSince('now', now)).toBe(now)
    expect(parseSince('5m', now).toISOString()).toBe('2026-01-01T11:55:00.000Z')
    expect(parseSince('2026-01-01T10:00:00Z', now).toISOString()).toBe('2026-01-01T10:00:00.000Z')
    expect(() => parseSince('yesterday', now)).toThrow(/--since/)
  })
})

describe('override config', () => {
  it('merges --config with the flags, the flags winning', () => {
    const config = buildConfig({
      config: '{"rates":{"deferred":5},"chaos":{"errorRate":1,"httpCodes":[503]}}',
      'hard-bounce': '20',
      invalid: '2',
      latency: '100-500',
      'error-rate': '10',
      rule: ['*@blocked.test=hard_bounce'],
    })
    expect(config).toEqual({
      rates: { deferred: 5, hard_bounce: 20, invalid: 2 },
      latency: { minMs: 100, maxMs: 500 },
      chaos: { errorRate: 10, httpCodes: [503] },
      rules: [{ match: '*@blocked.test', status: 'hard_bounce' }],
    })
    expect(buildConfig({ rule: [] })).toEqual({})
    expect(() => buildConfig({ config: '[1]', rule: [] })).toThrow(/--config/)
  })
})

describe('output and exit codes', () => {
  it('formats tables and .env lines', () => {
    expect(table(['A', 'B'], [['x', null]])).toBe('A  B\nx  -')
    expect(
      envLines([
        ['A', 'x'],
        ['B', undefined],
      ]),
    ).toBe('A=x')
  })

  it('maps failures to exit codes', () => {
    expect(describeFailure(new UsageError('bad')).code).toBe(EXIT.usage)
    const timeout = new MailsinkError({ code: 'wait_timeout', message: 'none', requestId: 'r1' })
    expect(describeFailure(timeout)).toEqual({
      code: EXIT.waitTimeout,
      message: 'wait_timeout: none (request r1)',
    })
    expect(describeFailure(new MailsinkError({ code: 'forbidden', message: 'no' })).code).toBe(
      EXIT.failure,
    )
    expect(describeFailure(new Error('boom')).code).toBe(EXIT.failure)
  })
})
