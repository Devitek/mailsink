import { describe, expect, it } from 'vitest'
import { BrevoSendRequest, BrevoSendResponse } from './brevo'
import { issueCode } from './common'

const base = {
  sender: { email: 'App@Example.com', name: 'App' },
  to: [{ email: 'jane@x.io' }],
  subject: 'Hi',
  htmlContent: '<p>Hi</p>',
}

const codes = (input: unknown) =>
  BrevoSendRequest.safeParse(input).error?.issues.map((i) => issueCode(i) ?? i.code) ?? []

describe('BrevoSendRequest', () => {
  it('accepts the SDK example and lower-cases addresses', () => {
    const parsed = BrevoSendRequest.parse(base)
    expect(parsed.sender).toEqual({ email: 'app@example.com', name: 'App' })
  })

  it('stringifies header values', () => {
    const parsed = BrevoSendRequest.parse({ ...base, headers: { 'X-Count': 3, 'X-On': true } })
    expect(parsed.headers).toEqual({ 'X-Count': '3', 'X-On': 'true' })
  })

  it('needs sender, subject and content without templateId', () => {
    expect(codes({ to: base.to })).toEqual(
      expect.arrayContaining(['content_required', 'sender_required', 'subject_required']),
    )
  })

  it('takes sender, subject and content from the template', () => {
    expect(codes({ to: base.to, templateId: 12 })).toEqual([])
  })

  it('needs to unless messageVersions is set', () => {
    expect(codes({ ...base, to: undefined })).toContain('to_required')
    expect(codes({ ...base, to: undefined, messageVersions: [{ to: base.to }] })).toEqual([])
  })

  it('accepts per-version subjects instead of a global one', () => {
    const versions = [{ to: base.to, subject: 'A' }, { to: base.to }]
    expect(codes({ ...base, subject: undefined, messageVersions: versions })).toContain(
      'subject_required',
    )
    versions[1] = { to: base.to, subject: 'B' }
    expect(codes({ ...base, subject: undefined, messageVersions: versions })).toEqual([])
  })

  it('caps a version at 99 recipients and a request at 2000', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ email: `u${i}@x.io` }))
    expect(codes({ ...base, to: many(100) })).toContain('too_big')
    const versions = Array.from({ length: 21 }, () => ({ to: many(99) }))
    expect(codes({ ...base, messageVersions: versions })).toContain('too_many_recipients')
  })

  it('needs a name with base64 content', () => {
    expect(codes({ ...base, attachment: [{ content: 'aGk=' }] })).toContain(
      'attachment_name_required',
    )
    expect(codes({ ...base, attachment: [{ name: 'a.txt' }] })).toContain(
      'attachment_content_required',
    )
    expect(codes({ ...base, attachment: [{ url: 'https://x.io/a.pdf' }] })).toEqual([])
  })
})

describe('BrevoSendResponse', () => {
  it('is a messageId or a list of messageIds', () => {
    expect(BrevoSendResponse.safeParse({ messageId: '<a@b>' }).success).toBe(true)
    expect(BrevoSendResponse.safeParse({ messageIds: ['<a@b>'] }).success).toBe(true)
  })
})
