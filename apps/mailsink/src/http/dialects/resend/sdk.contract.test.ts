// Contract tests: the official `resend` SDK pointed at Mailsink through its base URL.
import {
  ResendBatchResponse,
  ResendEmail,
  ResendErrorBody,
  ResendSendResponse,
} from '@mailsink/contracts'
import { attachments, messages } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { Resend } from 'resend'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../../../runtime/boot'
import { installTestRuntime } from '../../test-fixtures'
import { createResendWorkspace } from './test-seed'
import { startResendServer } from './test-server'

const from = 'Acme <onboarding@app.io>'

describeDb('Resend SDK contract', (ctx) => {
  let server: Awaited<ReturnType<typeof startResendServer>>
  let resend: Resend
  let seed: Awaited<ReturnType<typeof createResendWorkspace>>

  beforeAll(async () => {
    await installTestRuntime(ctx.handle)
    seed = await createResendWorkspace({ rateLimit: { limit: 100 } })
    server = await startResendServer()
    resend = new Resend(seed.resendKey, { baseUrl: server.baseUrl })
  })
  afterAll(async () => {
    await server.close()
    await stopRuntime()
  })

  it('emails.send stores the email, attachments included, and emails.get reads it', async () => {
    const sent = await resend.emails.send({
      from,
      to: ['delivered@x.io'],
      cc: 'cc@x.io',
      replyTo: 'help@app.io',
      subject: 'hello world',
      html: '<p>it works!</p>',
      text: 'it works!',
      tags: [{ name: 'category', value: 'confirm_email' }],
      attachments: [{ filename: 'hello.txt', content: Buffer.from('hello') }],
      headers: { 'X-Entity-Ref-ID': '123' },
    })
    expect(sent.error).toBeNull()
    const { id } = ResendSendResponse.parse(sent.data)
    expect(sent.headers?.['ratelimit-limit']).toBe('100')
    expect(sent.headers?.['x-ratelimit-limit']).toBe('100')

    const [row] = await ctx.db
      .select()
      .from(messages)
      .where(eq(messages.id, `msg_${id}`))
    expect(row).toMatchObject({
      source: 'resend',
      subject: 'hello world',
      replyTo: [{ email: 'help@app.io' }],
    })
    const files = await ctx.db
      .select()
      .from(attachments)
      .where(eq(attachments.messageId, `msg_${id}`))
    expect(files).toMatchObject([{ filename: 'hello.txt', sizeBytes: 5 }])

    const got = await resend.emails.get(id)
    expect(got.error).toBeNull()
    expect(ResendEmail.parse(got.data)).toMatchObject({
      id,
      from,
      to: ['delivered@x.io'],
      cc: ['cc@x.io'],
      reply_to: ['help@app.io'],
      subject: 'hello world',
      last_event: 'queued',
      tags: [{ name: 'category', value: 'confirm_email' }],
    })
  })

  it('batch.send is all or nothing by default, partial in permissive mode', async () => {
    const ok = { from, to: ['a@x.io'], subject: 'one', html: '<p>1</p>' }
    const sent = await resend.batch.send([ok, { ...ok, subject: 'two' }])
    expect(ResendBatchResponse.parse(sent.data).data).toHaveLength(2)

    const bad = { ...ok, to: 'not-an-address' }
    const strict = await resend.batch.send([ok, bad])
    expect(strict.data).toBeNull()
    expect(ResendErrorBody.parse(strict.error)).toMatchObject({
      statusCode: 400,
      name: 'validation_error',
    })

    const permissive = await resend.batch.send([ok, bad], { batchValidation: 'permissive' })
    expect(permissive.data?.data).toHaveLength(1)
    expect(permissive.data?.errors).toEqual([
      { index: 1, message: expect.stringMatching(/^Invalid `to`/) },
    ])
  })

  it('idempotencyKey replays the same id', async () => {
    const payload = { from, to: 'a@x.io', subject: 'once', text: 'once' }
    const first = await resend.emails.send(payload, { idempotencyKey: 'welcome/42' })
    const again = await resend.emails.send(payload, { idempotencyKey: 'welcome/42' })
    expect(again.data?.id).toBe(first.data?.id)
    const changed = await resend.emails.send(
      { ...payload, subject: 'x' },
      { idempotencyKey: 'welcome/42' },
    )
    expect(changed.error).toMatchObject({ statusCode: 409, name: 'invalid_idempotent_request' })
  })

  it('surfaces Resend errors through the SDK error object', async () => {
    const missing = await resend.emails.send({ from, to: 'a@x.io', subject: '' } as never)
    expect(missing.error).toEqual({
      statusCode: 422,
      name: 'missing_required_field',
      message: 'Missing `html` or `text` field.',
    })
    const unknown = await resend.emails.get('0190c9a4-0000-7000-8000-000000000000')
    expect(unknown.error).toMatchObject({ statusCode: 404, name: 'not_found' })
    const brevo = new Resend(seed.brevoKey, { baseUrl: server.baseUrl })
    const forbidden = await brevo.emails.send({ from, to: 'a@x.io', subject: 'x', text: 'x' })
    expect(forbidden.error).toMatchObject({ statusCode: 403, name: 'restricted_api_key' })
  })
})
