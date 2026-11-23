import { Brevo, BrevoClient, BrevoError } from '@getbrevo/brevo'
import { messages } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../../../runtime/boot'
import { installTestRuntime } from '../../test-fixtures'
import { postBrevoEmail } from './send'
import { provisionBrevo } from './testing'

// Contract test with the official Brevo Node SDK (`@getbrevo/brevo` 6.x): the client is
// pointed at `<public url>/v3` and its fetch is routed to the in-process route handler.

const BASE_URL = 'http://mailsink.test/v3'

const inProcessFetch: typeof fetch = async (input, init) => {
  const req = new Request(input, init)
  const { pathname } = new URL(req.url)
  if (pathname !== '/v3/smtp/email') return new Response('not found', { status: 404 })
  return postBrevoEmail({ request: req })
}

describeDb('Brevo SDK contract', (ctx) => {
  let client: BrevoClient
  let seed: Awaited<ReturnType<typeof provisionBrevo>>
  const sdk = (apiKey: string) =>
    new BrevoClient({ apiKey, baseUrl: BASE_URL, fetch: inProcessFetch, maxRetries: 0 })
  const stored = async (messageId: string | undefined) => {
    const [row] = await ctx.db
      .select()
      .from(messages)
      .where(eq(messages.providerMessageId, String(messageId)))
    return row
  }

  beforeAll(async () => {
    await installTestRuntime(ctx.handle)
    seed = await provisionBrevo({
      templates: [
        {
          externalId: 3,
          name: 'Order shipped',
          subject: 'Order {{ params.orderId }} shipped',
          html: '<p>Hi {{ contact.EMAIL }}, tracking {{ params.tracking }}</p>',
          sender: { email: 'shop@example.com', name: 'Shop' },
        },
      ],
    })
    client = sdk(seed.brevoKey)
  })
  afterAll(() => stopRuntime())

  it('sends inline content (SDK example) and returns the messageId', async () => {
    const res = await client.transactionalEmails.sendTransacEmail({
      htmlContent: '<p>Delivery {{params.estimatedArrival}}</p>',
      params: { estimatedArrival: 'Tomorrow' },
      sender: { email: 'hello@example.com', name: 'Alex' },
      subject: 'Hello from Brevo!',
      to: [{ email: 'johndoe@example.com', name: 'John Doe' }],
      tags: ['welcome'],
    })
    expect(res.messageId).toMatch(/^<msg_.+@mailsink>$/)
    expect(await stored(res.messageId)).toMatchObject({
      source: 'brevo',
      subject: 'Hello from Brevo!',
      html: '<p>Delivery Tomorrow</p>',
      tags: [{ name: 'tag', value: 'welcome' }],
    })
  })

  it('renders a seeded template from templateId and params', async () => {
    const res = await client.transactionalEmails.sendTransacEmail({
      templateId: 3,
      to: [{ email: 'jane@x.io' }],
      params: { orderId: 'A-1', tracking: 'JD014' },
    })
    expect(await stored(res.messageId)).toMatchObject({
      subject: 'Order A-1 shipped',
      html: '<p>Hi jane@x.io, tracking JD014</p>',
      from: { email: 'shop@example.com', name: 'Shop' },
    })
  })

  it('returns one messageId per message version', async () => {
    const res = await client.transactionalEmails.sendTransacEmail({
      sender: { email: 'hello@example.com' },
      subject: 'Hi {{ params.name }}',
      textContent: 'Hello',
      messageVersions: [
        { to: [{ email: 'a@x.io' }], params: { name: 'A' } },
        { to: [{ email: 'b@x.io' }], params: { name: 'B' }, subject: 'Yo {{ params.name }}' },
      ],
    })
    expect(res.messageId).toBeUndefined()
    expect(res.messageIds).toHaveLength(2)
    const subjects = await Promise.all(
      (res.messageIds ?? []).map(async (id) => (await stored(id))?.subject),
    )
    expect(subjects).toEqual(['Hi A', 'Yo B'])
  })

  it('surfaces a 400 as Brevo.BadRequestError with the Brevo body', async () => {
    const error = await client.transactionalEmails
      .sendTransacEmail({ to: [{ email: 'jane@x.io' }], subject: 'Hi', htmlContent: '<p/>' })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(Brevo.BadRequestError)
    expect((error as BrevoError).statusCode).toBe(400)
    expect((error as BrevoError).body).toEqual({
      code: 'missing_parameter',
      message: 'sender: sender is required when templateId is absent',
    })
  })

  it('surfaces an unknown key as a 401 BrevoError', async () => {
    const error = await sdk('msk_unknownunknownunknown')
      .transactionalEmails.sendTransacEmail({
        sender: { email: 'a@x.io' },
        to: [{ email: 'jane@x.io' }],
        subject: 'Hi',
        textContent: 'x',
      })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(BrevoError)
    expect((error as BrevoError).statusCode).toBe(401)
    expect((error as BrevoError).body).toMatchObject({ code: 'unauthorized' })
  })
})
