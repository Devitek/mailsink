import { describeDb } from '@mailsink/db/testing'
import { expect, it } from 'vitest'
import { extractCode, extractLinks, findLink, isMailsinkError } from '../src'
import { useHarness } from './harness'

describeDb('SDK messages', (ctx) => {
  const h = useHarness(ctx)

  it('lists with filters, reads the detail, the raw source and an attachment', async () => {
    const response = await fetch(`${h.server.url}/v1/emails`, {
      method: 'POST',
      headers: { authorization: `Bearer ${h.connectionKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'app@example.com',
        to: 'list@example.com',
        subject: 'With a file',
        text: 'See attached',
        attachments: [{ filename: 'café.txt', content: btoa('hello') }],
      }),
    })
    const { id } = (await response.json()) as { id: string }
    const page = await h.sink.messages.list({ to: 'list@example.com' })
    expect(page.data.map((m) => m.id)).toEqual([id])
    expect(page.data[0]).toMatchObject({ subject: 'With a file', hasAttachments: true })

    const detail = await h.sink.messages.get(id)
    expect(detail.text).toBe('See attached')
    const raw = await h.sink.messages.raw(id)
    expect(raw).toContain('Subject: With a file')
    const att = detail.attachments[0]
    if (!att) throw new Error('no attachment')
    const file = await h.sink.messages.attachment(id, att.id)
    expect(file.filename).toBe('café.txt')
    expect(file.contentType).toContain('text/plain')
    expect(new TextDecoder().decode(file.data)).toBe('hello')
  })

  it('waitFor matches a message sent after the call, the detail included', async () => {
    const waiting = h.sink.messages.waitFor({ to: 'wait@example.com' }, { timeout: 5_000 })
    await new Promise((r) => setTimeout(r, 50))
    const id = await h.send({ to: 'wait@example.com', subject: 'Late', html: '<p>Hi</p>' })
    const message = await waiting
    expect(message.id).toBe(id)
    expect(message.html).toBe('<p>Hi</p>')
  })

  it('waitFor misses a message stored before the call unless since is passed (pitfall)', async () => {
    const since = new Date()
    const id = await h.send({ to: 'early@example.com', subject: 'Early' })
    const missed = await h.sink.messages
      .waitFor({ to: 'early@example.com' }, { timeout: 300 })
      .catch((e: unknown) => e)
    expect(isMailsinkError(missed, 'wait_timeout')).toBe(true)
    expect((missed as Error).message).toMatch(/early@example.com/)
    const found = await h.sink.messages.waitFor({ to: 'early@example.com' }, { since })
    expect(found.id).toBe(id)
  })

  it('waitFor answers the earliest match when several are there', async () => {
    const since = new Date()
    const first = await h.send({ to: 'many@example.com', subject: 'One' })
    await h.send({ to: 'many@example.com', subject: 'Two' })
    const found = await h.sink.messages.waitFor({ to: 'many@example.com' }, { since })
    expect(found.id).toBe(first)
  })

  it('extracts links and the one-time code of a captured message', async () => {
    const since = new Date()
    await h.send({
      to: 'otp@example.com',
      subject: 'Sign in',
      text: 'Your code is 482913. Or open https://app.example.com/magic?token=abc&id=1234567.',
      html: '<p>Code <b>482913</b></p><a href="https://app.example.com/magic?token=abc&amp;id=1234567">Sign in</a>',
    })
    const message = await h.sink.messages.waitFor({ to: 'otp@example.com' }, { since })
    expect(extractLinks(message)).toContain('https://app.example.com/magic?token=abc&id=1234567')
    expect(findLink(message, '/magic')).toBe('https://app.example.com/magic?token=abc&id=1234567')
    expect(findLink(message, (url) => url.searchParams.get('token') === 'abc')).not.toBeNull()
    expect(extractCode(message)).toBe('482913')
  })

  it('forces an event, seeds the demo set and purges', async () => {
    const id = await h.send({ to: 'event@example.com', subject: 'Bounce me' })
    const result = await h.sink.messages.triggerEvent(id, { type: 'status', status: 'hard_bounce' })
    expect(result.events[0]).toMatchObject({ type: 'hard_bounce' })
    const demo = await h.sink.messages.seedDemo({ locale: 'fr' })
    expect(demo.count).toBe(8)
    const purged = await h.sink.messages.purge()
    expect(purged.count).toBeGreaterThanOrEqual(9)
    expect((await h.sink.messages.list()).data).toEqual([])
  })
})
