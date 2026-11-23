import type { StreamFrame } from '@mailsink/core'
import { connections, getBlobData, messageRecipients, messages } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import MailComposer from 'nodemailer/lib/mail-composer'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { type CredentialCache, createCredentialCache } from './credential-cache'
import { createSmtpAccount, type SmtpAccount, startTestServer } from './testing'

describeDb('SMTP server (nodemailer contract)', (ctx) => {
  let env: Awaited<ReturnType<typeof startTestServer>>
  let account: SmtpAccount

  beforeEach(async () => {
    account = await createSmtpAccount(ctx.db)
    env = await startTestServer(ctx.db)
  })
  afterEach(async () => {
    await env.server.close()
  })

  const auth = () => ({ user: account.user, pass: account.pass })

  it('stores a message sent with AUTH PLAIN and replies queued as msg_', async () => {
    const frames: StreamFrame[] = []
    env.bus.subscribe(account.workspaceId, (f) => frames.push(f))
    const raw = await new MailComposer({
      from: 'App <app@example.test>',
      to: 'alice@example.test',
      cc: 'carol@example.test',
      subject: 'Welcome',
      text: 'hello',
    })
      .compile()
      .build()
    const transport = env.transport(auth(), { authMethod: 'PLAIN' })
    const info = await transport.sendMail({
      envelope: {
        from: 'app@example.test',
        to: ['alice@example.test', 'carol@example.test', 'hidden@example.test'],
      },
      raw,
    })
    transport.close()

    const id = /^250 2\.0\.0 Ok: queued as (msg_\S+)$/.exec(info.response)?.[1]
    expect(id).toBeDefined()
    const [message] = await ctx.db
      .select()
      .from(messages)
      .where(eq(messages.id, id ?? ''))
    expect(message).toMatchObject({
      workspaceId: account.workspaceId,
      connectionId: account.connectionId,
      source: 'smtp',
      subject: 'Welcome',
      status: 'queued',
      providerMessageId: id,
    })
    const stored = await getBlobData(ctx.db, account.workspaceId, message?.rawBlobId ?? '')
    expect(Buffer.from(stored ?? []).equals(raw)).toBe(true)
    const recipients = await ctx.db
      .select({ email: messageRecipients.email, kind: messageRecipients.kind })
      .from(messageRecipients)
      .where(eq(messageRecipients.messageId, id ?? ''))
    expect(recipients).toEqual(
      expect.arrayContaining([
        { email: 'alice@example.test', kind: 'to' },
        { email: 'carol@example.test', kind: 'cc' },
        { email: 'hidden@example.test', kind: 'bcc' },
      ]),
    )
    expect(frames.map((f) => f.event.type)).toContain('message.created')
    expect(env.touched).toContain(account.workspaceId)
  })

  it('accepts AUTH LOGIN and runs scrypt once per password (D11 cache)', async () => {
    const cache = createCredentialCache()
    const hits: boolean[] = []
    const counting: CredentialCache = {
      has: (...args) => {
        const hit = cache.has(...args)
        hits.push(hit)
        return hit
      },
      remember: (...args) => cache.remember(...args),
      get size() {
        return cache.size
      },
    }
    await env.server.close()
    env = await startTestServer(ctx.db, { credentialCache: counting })
    for (let i = 0; i < 2; i++) {
      const transport = env.transport(auth(), { authMethod: 'LOGIN' })
      await transport.sendMail({ from: 'a@example.test', to: 'b@example.test', text: 'x' })
      transport.close()
    }
    expect(hits).toEqual([false, true])
  })

  it('answers 535 5.7.8 to a wrong password or an unknown user', async () => {
    for (const creds of [
      { user: account.user, pass: 'wrong' },
      { user: 'nobody', pass: account.pass },
    ]) {
      const transport = env.transport(creds)
      await expect(transport.verify()).rejects.toMatchObject({ responseCode: 535 })
      transport.close()
    }
  })

  it('refuses mail without AUTH (530)', async () => {
    const transport = env.transport(null)
    await expect(
      transport.sendMail({ from: 'a@example.test', to: 'b@example.test', text: 'x' }),
    ).rejects.toMatchObject({ responseCode: 530 })
    transport.close()
  })

  it('refuses a disabled connection like a wrong password', async () => {
    const disabled = await createSmtpAccount(ctx.db)
    await ctx.db
      .update(connections)
      .set({ disabledAt: new Date() })
      .where(eq(connections.id, disabled.connectionId))
    const transport = env.transport({ user: disabled.user, pass: disabled.pass })
    await expect(transport.verify()).rejects.toMatchObject({ responseCode: 535 })
    transport.close()
  })
})
