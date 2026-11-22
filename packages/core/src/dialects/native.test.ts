import { SendEmailRequest } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import { fromNativeRequest } from './native'

describe('fromNativeRequest', () => {
  it('maps a native request to a NormalizedEmail', () => {
    const request = SendEmailRequest.parse({
      from: 'App <App@Example.com>',
      to: 'jane@x.io',
      bcc: ['audit@x.io'],
      replyTo: { email: 'help@x.io', name: 'Help' },
      subject: 'Hi',
      html: '<p>Hi</p>',
      headers: { 'X-Campaign': 'c1' },
      tags: [{ name: 'kind', value: 'welcome' }],
      metadata: { userId: 42 },
      attachments: [
        { filename: 'a.txt', content: Buffer.from('hello').toString('base64') },
        { filename: 'logo.png', content: 'AAEC', contentType: 'image/png', contentId: 'logo' },
      ],
    })
    const email = fromNativeRequest(request)
    expect(email).toMatchObject({
      from: { email: 'app@example.com', name: 'App' },
      to: [{ email: 'jane@x.io' }],
      cc: [],
      bcc: [{ email: 'audit@x.io' }],
      replyTo: [{ email: 'help@x.io', name: 'Help' }],
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: null,
      headers: { 'X-Campaign': 'c1' },
      tags: [{ name: 'kind', value: 'welcome' }],
      metadata: { userId: 42 },
    })
    expect(email.attachments).toHaveLength(2)
    expect(Buffer.from(email.attachments[0]?.content ?? []).toString()).toBe('hello')
    expect(email.attachments[0]?.contentType).toBeUndefined()
    expect(email.attachments[1]).toMatchObject({ contentType: 'image/png', contentId: 'logo' })
    expect([...(email.attachments[1]?.content ?? [])]).toEqual([0, 1, 2])
  })
})
