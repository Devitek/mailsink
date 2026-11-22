import { describe, expect, it } from 'vitest'
import { Duration, Email, Page, parseDuration, QueryBool, Slug, Tag } from './common'

describe('Duration', () => {
  it.each([
    ['90s', 90],
    ['30m', 1_800],
    ['1h', 3_600],
    ['7d', 604_800],
  ])('parses %s to %i seconds', (input, seconds) => {
    expect(Duration.parse(input)).toBe(seconds)
  })

  it('keeps positive integer seconds', () => {
    expect(Duration.parse(42)).toBe(42)
  })

  it.each(['0s', '1w', '1.5h', 'h', '', ' 1h'])('rejects the string %j', (input) => {
    const result = Duration.safeParse(input)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({ params: { code: 'invalid_duration' } })
  })

  it.each([0, -5, 1.5])('rejects the number %d', (input) => {
    expect(Duration.safeParse(input).success).toBe(false)
  })

  it('exposes parseDuration', () => {
    expect(parseDuration('2d')).toBe(172_800)
    expect(parseDuration('2y')).toBeNull()
  })
})

describe('Email', () => {
  it('lower-cases', () => {
    expect(Email.parse('Jane@X.io')).toBe('jane@x.io')
  })
  it('rejects invalid e-mails', () => {
    expect(Email.safeParse('jane').success).toBe(false)
  })
})

describe('Slug', () => {
  it.each(['ab', 'live-the-wod-staging', '0ci'])('accepts %s', (s) => {
    expect(Slug.safeParse(s).success).toBe(true)
  })
  it.each(['a', '-ab', 'Ab', 'ws_123', 'a'.repeat(64)])('rejects %s', (s) => {
    expect(Slug.safeParse(s).success).toBe(false)
  })
})

describe('QueryBool', () => {
  it.each([
    ['true', true],
    ['1', true],
    ['false', false],
    [true, true],
    [false, false],
  ])('parses %j', (input, output) => {
    expect(QueryBool.parse(input)).toBe(output)
  })
  it('rejects garbage', () => {
    expect(QueryBool.safeParse('maybe').success).toBe(false)
  })
})

describe('Tag and Page', () => {
  it('validates tag names', () => {
    expect(Tag.safeParse({ name: 'flow-1_a', value: 'x' }).success).toBe(true)
    expect(Tag.safeParse({ name: 'bad name', value: 'x' }).success).toBe(false)
  })
  it('wraps items with a nullable cursor', () => {
    expect(Page(Tag).parse({ data: [], nextCursor: null })).toEqual({ data: [], nextCursor: null })
  })
})
