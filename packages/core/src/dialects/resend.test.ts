import { describe, expect, it } from 'vitest'
import { fromResendRequest, parseResendEmail, resendError } from './resend'

const base = { from: 'Acme <app@x.io>', to: 'jane@x.io', subject: 'Hi', html: '<p>Hi</p>' }
const issueOf = (input: unknown, batch = false) => {
  const parsed = parseResendEmail(input, { batch })
  if (parsed.ok) throw new Error('expected a refusal')
  return parsed.issue
}

describe('parseResendEmail', () => {
  it('words a missing required field as Resend', () => {
    expect(issueOf({ ...base, to: undefined })).toEqual({
      name: 'missing_required_field',
      status: 422,
      message: 'Missing `to` field.',
    })
    expect(issueOf(undefined).message).toBe('Missing `from` field.')
    expect(issueOf({ ...base, html: undefined }).message).toBe('Missing `html` or `text` field.')
  })

  it('words an invalid field with its path', () => {
    expect(issueOf({ ...base, from: 'nope' })).toEqual({
      name: 'validation_error',
      status: 400,
      message:
        'Invalid `from` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.',
    })
    expect(issueOf({ ...base, to: ['ok@x.io', 'bad'] }).message).toMatch(
      /^Invalid `to` field\. The email/,
    )
    expect(issueOf({ ...base, cc: 'bad' }).message).toMatch(/^Invalid `cc` field\. The email/)
    expect(issueOf({ ...base, subject: 3 }).message).toBe('Invalid `subject` field.')
  })

  it('answers attachment problems with invalid_attachment', () => {
    expect(issueOf({ ...base, attachments: [{ filename: 'a.txt' }] })).toMatchObject({
      name: 'invalid_attachment',
      status: 422,
      message: 'Attachment must have either a `content` or `path`.',
    })
  })

  it('refuses attachments in a batch item', () => {
    const item = { ...base, attachments: [{ content: 'aGk=', filename: 'a.txt' }] }
    expect(parseResendEmail(item).ok).toBe(true)
    expect(issueOf(item, true).message).toBe(
      'The `attachments` field is not supported for batch emails.',
    )
  })
})

describe('fromResendRequest', () => {
  it('maps snake_case fields to NormalizedEmail', () => {
    const parsed = parseResendEmail({
      ...base,
      reply_to: 'help@x.io',
      tags: [{ name: 'a', value: 'b' }],
      attachments: [{ content: 'aGk=', filename: 'a.txt', content_id: 'logo' }],
    })
    if (!parsed.ok) throw new Error('expected a valid request')
    const email = fromResendRequest(parsed.data)
    expect(email).toMatchObject({
      from: { email: 'app@x.io', name: 'Acme' },
      to: [{ email: 'jane@x.io' }],
      replyTo: [{ email: 'help@x.io' }],
      text: null,
      metadata: null,
      tags: [{ name: 'a', value: 'b' }],
    })
    expect(email.attachments[0]).toMatchObject({ filename: 'a.txt', contentId: 'logo' })
    expect(Buffer.from(email.attachments[0]?.content ?? []).toString()).toBe('hi')
  })
})

describe('resendError', () => {
  it('carries the Resend name for the formatter', () => {
    const error = resendError({ name: 'invalid_attachment', status: 422, message: 'x' })
    expect(error).toMatchObject({ code: 'validation_error', status: 422 })
    expect(error.details).toEqual({ resend: 'invalid_attachment' })
  })
})
