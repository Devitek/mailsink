import MailComposer from 'nodemailer/lib/mail-composer'
import { describe, expect, it } from 'vitest'
import { isDomainError } from '../errors'
import { fromSmtpMessage } from './smtp'

async function eml(options: ConstructorParameters<typeof MailComposer>[0]): Promise<Uint8Array> {
  return new Uint8Array(await new MailComposer(options).compile().build())
}

describe('fromSmtpMessage', () => {
  it('maps headers, bodies and keeps the raw EML as is', async () => {
    const raw = await eml({
      from: 'App <App@Example.test>',
      to: 'Alice <alice@example.test>',
      cc: 'carol@example.test',
      replyTo: 'support@example.test',
      subject: 'Hello',
      text: 'plain body',
      html: '<p>html body</p>',
      headers: { 'X-Campaign': 'spring' },
    })
    const email = await fromSmtpMessage(raw, {
      mailFrom: 'bounce@example.test',
      rcptTo: ['alice@example.test', 'carol@example.test'],
    })
    expect(email.raw).toBe(raw)
    expect(email.from).toEqual({ email: 'app@example.test', name: 'App' })
    expect(email.to).toEqual([{ email: 'alice@example.test', name: 'Alice' }])
    expect(email.cc).toEqual([{ email: 'carol@example.test' }])
    expect(email.bcc).toEqual([])
    expect(email.replyTo).toEqual([{ email: 'support@example.test' }])
    expect(email.subject).toBe('Hello')
    expect(email.text?.trim()).toBe('plain body')
    expect(email.html).toBe('<p>html body</p>')
    expect(email.headers['x-campaign']).toBe('spring')
    expect(email.headers).not.toHaveProperty('subject')
    expect(email.headers).not.toHaveProperty('content-type')
    expect(email.tags).toEqual([])
    expect(email.metadata).toBeNull()
  })

  it('takes recipients from the envelope: unlisted ones are bcc, unsent ones dropped', async () => {
    const raw = await eml({
      from: 'app@example.test',
      to: ['alice@example.test', 'ghost@example.test'],
      subject: 's',
      text: 't',
    })
    const email = await fromSmtpMessage(raw, {
      mailFrom: 'app@example.test',
      rcptTo: ['Alice@Example.test', 'hidden@example.test'],
    })
    expect(email.to).toEqual([{ email: 'alice@example.test' }])
    expect(email.bcc).toEqual([{ email: 'hidden@example.test' }])
  })

  it('falls back to the envelope sender and an empty subject', async () => {
    const raw = new TextEncoder().encode('To: a@example.test\r\n\r\nbody\r\n')
    const email = await fromSmtpMessage(raw, {
      mailFrom: 'Sender@example.test',
      rcptTo: ['a@example.test'],
    })
    expect(email.from).toEqual({ email: 'sender@example.test' })
    expect(email.subject).toBe('')
    expect(email.html).toBeNull()
  })

  it('refuses a message without any sender', async () => {
    const raw = new TextEncoder().encode('To: a@example.test\r\n\r\nbody\r\n')
    const error = await fromSmtpMessage(raw, { mailFrom: null, rcptTo: ['a@example.test'] }).catch(
      (e: unknown) => e,
    )
    expect(isDomainError(error) && error.code).toBe('validation_error')
  })

  it('keeps attachments, inline ones with their content id and cid links', async () => {
    const raw = await eml({
      from: 'app@example.test',
      to: 'a@example.test',
      subject: 's',
      html: '<img src="cid:logo@x">',
      attachments: [
        { filename: 'report.pdf', content: Buffer.from('PDF'), contentType: 'application/pdf' },
        { filename: 'logo.png', content: Buffer.from('PNG'), cid: 'logo@x' },
      ],
    })
    const email = await fromSmtpMessage(raw, { mailFrom: null, rcptTo: ['a@example.test'] })
    expect(email.html).toContain('cid:logo@x')
    expect(email.attachments).toHaveLength(2)
    const report = email.attachments.find((a) => a.filename === 'report.pdf')
    const logo = email.attachments.find((a) => a.filename === 'logo.png')
    expect(report?.contentType).toBe('application/pdf')
    expect(report?.contentId).toBeUndefined()
    expect(Buffer.from(report?.content ?? []).toString()).toBe('PDF')
    expect(logo?.contentId).toBe('logo@x')
  })

  it('joins repeated headers and unfolds long ones', async () => {
    const raw = new TextEncoder().encode(
      'From: a@example.test\r\nReceived: one\r\nReceived: two\r\nX-Long: first\r\n second\r\n\r\nb\r\n',
    )
    const email = await fromSmtpMessage(raw, { mailFrom: null, rcptTo: ['b@example.test'] })
    expect(email.headers.received).toBe('one, two')
    expect(email.headers['x-long']).toBe('first second')
  })
})
