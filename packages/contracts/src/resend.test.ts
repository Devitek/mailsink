import { describe, expect, it } from 'vitest'
import { issueCode } from './common'
import { ResendBatchResponse, ResendErrorBody, ResendSendRequest } from './resend'

const base = { from: 'Acme <app@x.io>', to: 'jane@x.io', subject: 'Hi', html: '<p>Hi</p>' }
const codes = (input: unknown) => ResendSendRequest.safeParse(input).error?.issues.map(issueCode)

describe('ResendSendRequest', () => {
  it('parses the snake_case payload of the SDK', () => {
    const parsed = ResendSendRequest.parse({
      ...base,
      to: ['Jane <Jane@X.io>', 'bob@x.io'],
      reply_to: 'help@x.io',
      tags: [{ name: 'category', value: 'confirm_email' }],
      attachments: [{ content: 'aGVsbG8=', filename: 'a.txt', content_type: 'text/plain' }],
      scheduled_at: 'in 1 min',
    })
    expect(parsed.from).toEqual({ email: 'app@x.io', name: 'Acme' })
    expect(parsed.to).toEqual([{ email: 'jane@x.io', name: 'Jane' }, { email: 'bob@x.io' }])
    expect(parsed.reply_to).toEqual([{ email: 'help@x.io' }])
  })

  it('accepts camelCase replyTo of older SDKs', () => {
    expect(ResendSendRequest.parse({ ...base, replyTo: ['a@x.io'] }).replyTo).toEqual([
      { email: 'a@x.io' },
    ])
  })

  it('rejects address objects, which Resend does not take', () => {
    expect(ResendSendRequest.safeParse({ ...base, to: { email: 'jane@x.io' } }).success).toBe(false)
    expect(codes({ ...base, from: 'not an address' })).toContain('invalid_address')
  })

  it('needs html or text and at least one recipient, at most 50', () => {
    expect(codes({ ...base, html: undefined })).toContain('html_or_text_required')
    expect(ResendSendRequest.safeParse({ ...base, html: undefined, text: '' }).success).toBe(true)
    expect(codes({ ...base, to: [] })).toContain('to_required')
    const to = Array.from({ length: 51 }, (_, i) => `u${i}@x.io`)
    expect(codes({ ...base, to })).toContain('too_many_recipients')
  })

  it('refuses templates and path attachments, which Mailsink cannot resolve', () => {
    expect(codes({ ...base, template: { id: 'welcome' } })).toContain('template_unsupported')
    expect(codes({ ...base, attachments: [{ path: 'https://x.io/a.pdf' }] })).toContain(
      'attachment_path_unsupported',
    )
    expect(codes({ ...base, attachments: [{ filename: 'a.txt' }] })?.[0]).toBe(
      'attachment_content_required',
    )
  })

  it('checks tag characters', () => {
    expect(
      ResendSendRequest.safeParse({ ...base, tags: [{ name: 'a b', value: 'x' }] }).success,
    ).toBe(false)
  })
})

describe('Resend responses', () => {
  it('batch errors are only present in permissive mode', () => {
    const id = '4ef9a417-02e9-4d39-ad75-9611e0fcc33c'
    expect(ResendBatchResponse.parse({ data: [{ id }] })).toEqual({ data: [{ id }] })
    expect(
      ResendBatchResponse.parse({ data: [], errors: [{ index: 0, message: 'x' }] }).errors,
    ).toHaveLength(1)
  })

  it('error body is { statusCode, name, message }', () => {
    expect(
      ResendErrorBody.safeParse({ statusCode: 429, name: 'rate_limit_exceeded', message: 'x' })
        .success,
    ).toBe(true)
  })
})
