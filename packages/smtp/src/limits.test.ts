import { insertOverride, messageRecipients, messages, newId } from '@mailsink/db'
import { createTestSuppression, describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { afterEach, expect, it } from 'vitest'
import { createSmtpAccount, smtpDialogue, startTestServer } from './testing'

const mail = { from: 'app@example.test', to: 'alice@example.test', subject: 's', text: 'x' }

describeDb('SMTP server limits, chaos and suppression', (ctx) => {
  let env: Awaited<ReturnType<typeof startTestServer>> | undefined

  afterEach(async () => {
    await env?.server.close()
    env = undefined
  })

  it('refuses a message over the size cap with 552 and stores nothing', async () => {
    const account = await createSmtpAccount(ctx.db)
    env = await startTestServer(ctx.db, { maxMessageBytes: 2_000 })
    const transport = env.transport(account)
    const error = await transport
      .sendMail({ ...mail, text: 'x'.repeat(5_000) })
      .catch((e: { responseCode: number; response: string }) => e)
    // Undeclared size: Mailsink's own reply once DATA crosses the cap.
    expect(error).toMatchObject({
      responseCode: 552,
      response: '552 5.3.4 Message exceeds the 2000 bytes limit',
    })
    transport.close()
    const stored = await ctx.db
      .select()
      .from(messages)
      .where(eq(messages.workspaceId, account.workspaceId))
    expect(stored).toEqual([])
  })

  it('refuses a declared SIZE above the cap at MAIL FROM with the smtp-server text', async () => {
    const account = await createSmtpAccount(ctx.db)
    env = await startTestServer(ctx.db, { maxMessageBytes: 2_000 })
    const plain = Buffer.from(`\0${account.user}\0${account.pass}`).toString('base64')
    const replies = await smtpDialogue(env.server.port, [
      'EHLO client.test',
      `AUTH PLAIN ${plain}`,
      'MAIL FROM:<app@example.test> SIZE=5000',
      'QUIT',
    ])
    // Text fixed by smtp-server before onMailFrom runs, without enhanced code (D159).
    expect(replies[3]).toBe('552 Error: message exceeds fixed maximum message size 2000')
  })

  it('answers 451 4.7.1 once the rate limit of the connection is spent', async () => {
    const account = await createSmtpAccount(ctx.db, { rateLimit: { limit: 1, windowSeconds: 60 } })
    env = await startTestServer(ctx.db)
    const transport = env.transport(account)
    await transport.sendMail(mail)
    const error = await transport
      .sendMail(mail)
      .catch((e: { responseCode: number; response: string }) => e)
    transport.close()
    expect(error).toMatchObject({ responseCode: 451 })
    expect((error as { response: string }).response).toMatch(
      /^451 4\.7\.1 Rate limit exceeded, retry in \d+s$/,
    )
  })

  it('fails the transaction with a chaos code from the active override', async () => {
    const account = await createSmtpAccount(ctx.db)
    await insertOverride(ctx.db, {
      id: newId('ovr'),
      workspaceId: account.workspaceId,
      connectionId: null,
      config: { chaos: { errorRate: 100, httpCodes: [500], smtpCodes: [452] } },
      activatedVia: 'api',
      expiresAt: null,
      createdAt: new Date(Date.now() - 1_000),
    })
    env = await startTestServer(ctx.db, { random: () => 0 })
    const transport = env.transport(account)
    const error = await transport.sendMail(mail).catch((e: { response: string }) => e)
    transport.close()
    expect((error as { response: string }).response).toBe(
      '452 4.3.1 Insufficient system storage (chaos injected)',
    )
  })

  it('accepts a suppressed recipient and marks it suppressed', async () => {
    const account = await createSmtpAccount(ctx.db)
    await createTestSuppression(ctx.db, account.workspaceId, 'blocked@example.test')
    env = await startTestServer(ctx.db)
    const transport = env.transport(account)
    const info = await transport.sendMail({
      ...mail,
      to: ['blocked@example.test', 'ok@example.test'],
    })
    transport.close()
    expect(info.accepted).toEqual(['blocked@example.test', 'ok@example.test'])
    const id = info.response.split(' ').at(-1) ?? ''
    const rows = await ctx.db
      .select({ email: messageRecipients.email, status: messageRecipients.status })
      .from(messageRecipients)
      .where(eq(messageRecipients.messageId, id))
    expect(rows).toEqual(
      expect.arrayContaining([
        { email: 'blocked@example.test', status: 'suppressed' },
        { email: 'ok@example.test', status: 'queued' },
      ]),
    )
  })
})
