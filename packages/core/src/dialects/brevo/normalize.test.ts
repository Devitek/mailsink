import { BrevoSendRequest, type BrevoSendRequestInput } from '@mailsink/contracts'
import type { Template } from '@mailsink/db'
import { describe, expect, it } from 'vitest'
import { isDomainError } from '../../errors'
import { fromBrevoRequest } from './normalize'

const request = (patch: Partial<BrevoSendRequestInput> = {}) =>
  BrevoSendRequest.parse({
    sender: { email: 'app@example.com', name: 'App' },
    to: [{ email: 'jane@x.io', name: 'Jane' }],
    subject: 'Hi {{ params.name }}',
    htmlContent: '<p>{{ params.name }} {{ contact.EMAIL }}</p>',
    params: { name: 'Jane & co' },
    ...patch,
  })

const template = (patch: Partial<Template> = {}): Template => ({
  id: 'tpl_1',
  workspaceId: 'ws_1',
  externalId: 7,
  name: 'Welcome',
  subject: 'Welcome {{ params.name }}',
  html: '<h1>{{ params.name }}</h1>',
  text: 'Welcome {{ params.name }}',
  sender: { email: 'tpl@example.com', name: 'Template' },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...patch,
})

describe('fromBrevoRequest', () => {
  it('maps inline content and renders params (html escaped)', () => {
    const [email] = fromBrevoRequest(request(), null)
    expect(email).toMatchObject({
      from: { email: 'app@example.com', name: 'App' },
      to: [{ email: 'jane@x.io', name: 'Jane' }],
      subject: 'Hi Jane & co',
      html: '<p>Jane &amp; co jane@x.io</p>',
      text: null,
    })
    expect(email?.templateRef).toBeUndefined()
  })

  it('uses the template subject, sender and bodies, and records the template ref', () => {
    const req = request({ sender: undefined, subject: undefined, templateId: 7 })
    const [email] = fromBrevoRequest(req, template())
    expect(email).toMatchObject({
      from: { email: 'tpl@example.com', name: 'Template' },
      subject: 'Welcome Jane & co',
      html: '<h1>Jane &amp; co</h1>',
      text: 'Welcome Jane & co',
      templateRef: { templateId: 7, params: { name: 'Jane & co' } },
    })
  })

  it('lets the request override the template subject and sender', () => {
    const [email] = fromBrevoRequest(request({ templateId: 7 }), template())
    expect(email?.subject).toBe('Hi Jane & co')
    expect(email?.from.email).toBe('app@example.com')
  })

  it('refuses a template without sender when the request has none', () => {
    const req = request({ sender: undefined, templateId: 7 })
    try {
      fromBrevoRequest(req, template({ sender: null }))
      expect.unreachable()
    } catch (error) {
      expect(isDomainError(error) && error.status).toBe(400)
    }
  })

  it('makes one email per message version, version params over global ones', () => {
    const emails = fromBrevoRequest(
      request({
        cc: [{ email: 'cc@x.io' }],
        messageVersions: [
          { to: [{ email: 'a@x.io' }], params: { name: 'A' } },
          {
            to: [{ email: 'b@x.io' }],
            subject: 'Yo {{ params.name }}',
            bcc: [{ email: 'k@x.io' }],
          },
        ],
      }),
      null,
    )
    expect(emails.map((e) => [e.to[0]?.email, e.subject, e.cc.length, e.bcc.length])).toEqual([
      ['a@x.io', 'Hi A', 1, 0],
      ['b@x.io', 'Yo Jane & co', 1, 1],
    ])
    expect(emails[1]?.html).toBe('<p>Jane &amp; co b@x.io</p>')
  })

  it('maps tags, attachments and the Brevo extras', () => {
    const [email] = fromBrevoRequest(
      request({
        tags: ['welcome'],
        scheduledAt: '2026-11-23T10:00:00.000Z',
        attachment: [
          { name: 'a.txt', content: Buffer.from('hi').toString('base64') },
          { url: 'https://x.io/b.pdf' },
        ],
      }),
      null,
    )
    expect(email?.tags).toEqual([{ name: 'tag', value: 'welcome' }])
    expect(email?.attachments).toHaveLength(1)
    expect(Buffer.from(email?.attachments[0]?.content ?? []).toString()).toBe('hi')
    expect(email?.metadata).toEqual({
      brevo: {
        scheduledAt: '2026-11-23T10:00:00.000Z',
        attachmentUrls: [{ url: 'https://x.io/b.pdf', name: null }],
      },
    })
  })
})
