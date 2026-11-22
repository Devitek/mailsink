import { describe, expect, it } from 'vitest'
import { issueCode } from './common'
import { BatchRequest, BatchResponse, parseBatchItem, SendEmailRequest } from './native'

const base = { from: 'App <app@x.io>', to: 'jane@x.io', subject: 'Hi', text: 'Hello' }
const codes = (input: unknown) => SendEmailRequest.safeParse(input).error?.issues.map(issueCode)

describe('SendEmailRequest', () => {
  it('normalizes addresses', () => {
    const parsed = SendEmailRequest.parse({ ...base, replyTo: 'Support <help@x.io>' })
    expect(parsed.from).toEqual({ email: 'app@x.io', name: 'App' })
    expect(parsed.to).toEqual([{ email: 'jane@x.io' }])
    expect(parsed.replyTo).toEqual([{ email: 'help@x.io', name: 'Support' }])
  })

  it('requires html or text', () => {
    expect(codes({ ...base, text: undefined })).toContain('html_or_text_required')
    expect(codes({ ...base, text: '' })).toContain('html_or_text_required')
    expect(SendEmailRequest.safeParse({ ...base, text: undefined, html: '<p>x</p>' }).success).toBe(
      true,
    )
  })

  it('requires at least one to', () => {
    expect(codes({ ...base, to: [] })).toContain('to_required')
  })

  it('caps to + cc + bcc at 50', () => {
    const list = (n: number, p: string) => Array.from({ length: n }, (_, i) => `${p}${i}@x.io`)
    const ok = { ...base, to: list(20, 't'), cc: list(20, 'c'), bcc: list(10, 'b') }
    expect(SendEmailRequest.safeParse(ok).success).toBe(true)
    expect(codes({ ...ok, bcc: list(11, 'b') })).toContain('too_many_recipients')
  })

  it('validates attachments as base64', () => {
    const att = (content: string) => ({ ...base, attachments: [{ filename: 'a.txt', content }] })
    expect(SendEmailRequest.safeParse(att('aGVsbG8=')).success).toBe(true)
    expect(SendEmailRequest.safeParse(att('not base64!')).success).toBe(false)
  })

  it('validates tags', () => {
    expect(
      SendEmailRequest.safeParse({ ...base, tags: [{ name: 'a b', value: 'x' }] }).success,
    ).toBe(false)
  })
})

describe('BatchRequest', () => {
  it('accepts 1 to 100 items', () => {
    expect(BatchRequest.safeParse([base]).success).toBe(true)
    expect(BatchRequest.safeParse(Array(100).fill(base)).success).toBe(true)
  })
  it('rejects empty and oversized batches', () => {
    expect(BatchRequest.safeParse([]).success).toBe(false)
    expect(BatchRequest.safeParse(Array(101).fill(base)).success).toBe(false)
  })
  it('validates items one by one (partial success)', () => {
    const results = BatchRequest.parse([base, { ...base, to: 'nope' }]).map(parseBatchItem)
    expect(results[0]?.ok).toBe(true)
    expect(results[1]).toMatchObject({ ok: false, error: { code: 'validation_error' } })
  })
})

describe('BatchResponse', () => {
  it('discriminates on ok', () => {
    const body = {
      data: [
        { ok: true, index: 0, id: 'msg_01' },
        { ok: false, index: 1, error: { code: 'validation_error', message: 'Invalid' } },
      ],
    }
    expect(BatchResponse.safeParse(body).success).toBe(true)
    expect(BatchResponse.safeParse({ data: [{ ok: true, index: 0 }] }).success).toBe(false)
  })
})
