import { describe, expect, it } from 'vitest'
import { attachmentContentType, composeEml } from './compose-eml'
import type { NormalizedEmail } from './normalize'

const email: NormalizedEmail = {
  from: { email: 'app@example.com', name: 'App' },
  to: [{ email: 'jane@x.io' }],
  cc: [{ email: 'cc@x.io', name: 'Copy' }],
  bcc: [{ email: 'secret@x.io' }],
  replyTo: [{ email: 'help@x.io' }],
  subject: 'Welcome',
  html: '<p>Hello</p>',
  text: 'Hello',
  headers: { 'X-Campaign': 'c1' },
  tags: [],
  metadata: null,
  attachments: [
    { filename: 'report.pdf', content: new Uint8Array(Buffer.from('%PDF-1.4')) },
    { filename: 'logo.png', contentId: 'logo', content: new Uint8Array([1, 2, 3]) },
  ],
}

describe('composeEml', () => {
  it('composes a MIME message with headers, parts and attachments', async () => {
    const raw = Buffer.from(
      await composeEml(email, { messageId: 'msg_1', date: new Date('2026-11-22T10:00:00Z') }),
    ).toString()
    expect(raw).toMatch(/^From: App <app@example\.com>$/m)
    expect(raw).toMatch(/^To: jane@x\.io$/m)
    expect(raw).toMatch(/^Cc: Copy <cc@x\.io>$/m)
    expect(raw).toMatch(/^Reply-To: help@x\.io$/m)
    expect(raw).toMatch(/^Subject: Welcome$/m)
    expect(raw).toMatch(/^Message-ID: <msg_1@mailsink>$/m)
    expect(raw).toMatch(/^Date: Sun, 22 Nov 2026 10:00:00 \+0000$/m)
    expect(raw).toMatch(/^X-Campaign: c1$/m)
    expect(raw).toContain('Content-Type: text/plain')
    expect(raw).toContain('Content-Type: text/html')
    expect(raw).toMatch(/Content-Type: application\/pdf; name=report\.pdf/)
    expect(raw).toContain('Content-ID: <logo>')
    expect(raw).not.toMatch(/^Bcc:/im)
  })

  it('detects the attachment content type from the filename', () => {
    expect(attachmentContentType({ filename: 'a.csv', content: new Uint8Array() })).toBe('text/csv')
    expect(attachmentContentType({ filename: 'a', content: new Uint8Array() })).toBe(
      'application/octet-stream',
    )
    expect(
      attachmentContentType({ filename: 'a.csv', contentType: 'x/y', content: new Uint8Array() }),
    ).toBe('x/y')
  })
})
