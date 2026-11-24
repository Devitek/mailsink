import { Brevo, BrevoClient, type BrevoError } from '@getbrevo/brevo'
import { messages } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../../../runtime/boot'
import { postMessageEventApi } from '../../capture/events'
import { installTestRuntime, request } from '../../test-fixtures'
import { BREVO_TEST_BASE_URL, brevoFetch, provisionBrevo } from './testing'

// Contract test of the Brevo read routes (#149) with the official SDK (`@getbrevo/brevo`
// 6.x): `getTransacEmailsList`, `getTransacBlockedContacts` and
// `unblockOrResubscribeATransactionalContact`.

describeDb('Brevo SDK contract: read routes', (ctx) => {
  let seed: Awaited<ReturnType<typeof provisionBrevo>>
  let client: BrevoClient
  let messageId = ''
  const sdk = (apiKey: string) =>
    new BrevoClient({ apiKey, baseUrl: BREVO_TEST_BASE_URL, fetch: brevoFetch, maxRetries: 0 })
  const failure = (p: Promise<unknown>) =>
    p.then(
      () => null,
      (e: BrevoError) => e,
    )

  beforeAll(async () => {
    await installTestRuntime(ctx.handle)
    seed = await provisionBrevo()
    client = sdk(seed.brevoKey)
    const sent = await client.transactionalEmails.sendTransacEmail({
      sender: { email: 'shop@acme.test', name: 'Acme' },
      to: [{ email: 'jane@acme.test' }, { email: 'gone@acme.test' }],
      subject: 'Your order',
      textContent: 'Thanks',
      tags: ['orders'],
    })
    messageId = sent.messageId ?? ''
    const [row] = await ctx.db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.providerMessageId, messageId))
    const id = row?.id ?? ''
    const bounced = await postMessageEventApi({
      request: request(`/capture/messages/${id}/events`, {
        method: 'POST',
        bearer: seed.workspaceKey,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'status',
          status: 'hard_bounce',
          recipient: 'gone@acme.test',
        }),
      }),
      params: { id },
    })
    expect(bounced.status).toBe(202)
  })
  afterAll(() => stopRuntime())

  it('lists the transactional emails of the connection (getTransacEmailsList)', async () => {
    const list = await client.transactionalEmails.getTransacEmailsList({ messageId, sort: 'asc' })
    expect(list.count).toBe(2)
    expect(list.transactionalEmails).toEqual([
      {
        email: 'jane@acme.test',
        subject: 'Your order',
        messageId,
        uuid: expect.any(String),
        date: expect.any(String),
        from: 'shop@acme.test',
        tags: ['orders'],
      },
      expect.objectContaining({ email: 'gone@acme.test' }),
    ])
    const one = await client.transactionalEmails.getTransacEmailsList({
      email: 'gone@acme.test',
      limit: 1,
    })
    expect(one.transactionalEmails?.map((e) => e.messageId)).toEqual([messageId])
  })

  it('answers the Brevo 400 codes on invalid filters', async () => {
    const none = await failure(client.transactionalEmails.getTransacEmailsList({}))
    expect(none).toBeInstanceOf(Brevo.BadRequestError)
    expect(none?.body).toMatchObject({ code: 'missing_parameter' })
    const tooLong = await failure(
      client.transactionalEmails.getTransacEmailsList({
        email: 'jane@acme.test',
        startDate: '2026-01-01',
        endDate: '2026-03-01',
      }),
    )
    expect(tooLong?.body).toMatchObject({ code: 'out_of_range' })
  })

  it('lists and unblocks the blocked contacts of the workspace', async () => {
    const blocked = await client.transactionalEmails.getTransacBlockedContacts({
      senders: ['shop@acme.test'],
    })
    expect(blocked).toEqual({
      count: 1,
      contacts: [
        {
          email: 'gone@acme.test',
          senderEmail: 'shop@acme.test',
          reason: { code: 'hardBounce', message: 'Hard bounce' },
          blockedAt: expect.any(String),
        },
      ],
    })
    await client.transactionalEmails.unblockOrResubscribeATransactionalContact({
      email: 'gone@acme.test',
    })
    expect(await client.transactionalEmails.getTransacBlockedContacts()).toEqual({
      count: 0,
      contacts: [],
    })
    const again = await failure(
      client.transactionalEmails.unblockOrResubscribeATransactionalContact({
        email: 'gone@acme.test',
      }),
    )
    expect(again).toBeInstanceOf(Brevo.NotFoundError)
    expect(again?.body).toMatchObject({ code: 'document_not_found' })
    const invalid = await failure(
      client.transactionalEmails.unblockOrResubscribeATransactionalContact({ email: 'nope' }),
    )
    expect(invalid).toBeInstanceOf(Brevo.BadRequestError)
  })

  it('refuses the key of another connection kind with permission_denied', async () => {
    const error = await failure(sdk(seed.resendKey).transactionalEmails.getTransacBlockedContacts())
    expect(error?.statusCode).toBe(403)
    expect(error?.body).toMatchObject({ code: 'permission_denied' })
  })
})
