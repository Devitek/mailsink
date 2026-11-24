import { BrevoSendRequest, type BrevoSendRequestInput, TemplateInput } from '@mailsink/contracts'
import { idempotencyKeys, messageRecipients, messages } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { eq, inArray } from 'drizzle-orm'
import { beforeAll, expect, it } from 'vitest'
import { isDomainError } from '../../errors'
import type { IngestTarget } from '../../ingestion/normalize'
import { seedTarget } from '../../ingestion/testing/fixtures'
import { insertTemplateInputs } from '../../templates/service'
import { sendBrevoEmail } from './send'

const base: BrevoSendRequestInput = {
  sender: { email: 'app@example.com' },
  to: [{ email: 'jane@x.io' }],
  subject: 'Hi',
  textContent: 'Hello',
}

describeDb('Brevo dialect: sendBrevoEmail', (ctx) => {
  let target: IngestTarget
  beforeAll(async () => {
    target = { ...(await seedTarget(ctx.db)), source: 'brevo' }
    await ctx.db.transaction((tx) =>
      insertTemplateInputs(tx, target.workspaceId, [
        TemplateInput.parse({
          externalId: 12,
          name: 'Reset',
          subject: 'Reset for {{ params.name }}',
          html: '<a href="{{ params.url }}">reset</a>',
          sender: 'Support <support@app.io>',
        }),
      ]),
    )
  })
  const send = (input: BrevoSendRequestInput, key?: string) =>
    sendBrevoEmail(
      { db: ctx.db, maxMessageBytes: 1 << 20 },
      target,
      BrevoSendRequest.parse(input),
      key,
    )

  it('answers 201 with the Message-ID of the stored message', async () => {
    const { response } = await send(base)
    expect(response.status).toBe(201)
    const { messageId } = response.body as { messageId: string }
    expect(messageId).toMatch(/^<msg_[\w-]+@mailsink>$/)
    const [row] = await ctx.db
      .select()
      .from(messages)
      .where(eq(messages.providerMessageId, messageId))
    expect(row).toMatchObject({ source: 'brevo', subject: 'Hi', connectionId: target.connectionId })
  })

  it('renders a template with params and keeps its links', async () => {
    const { response } = await send({
      to: [{ email: 'jane@x.io' }],
      templateId: 12,
      params: { name: 'Jane', url: 'https://app.io/reset?t=1' },
    })
    const { messageId } = response.body as { messageId: string }
    const [row] = await ctx.db
      .select()
      .from(messages)
      .where(eq(messages.providerMessageId, messageId))
    expect(row).toMatchObject({
      subject: 'Reset for Jane',
      from: { email: 'support@app.io', name: 'Support' },
      templateRef: { templateId: 12, params: { name: 'Jane', url: 'https://app.io/reset?t=1' } },
    })
    expect(row?.links).toEqual([{ url: 'https://app.io/reset?t=1', text: 'reset' }])
  })

  it('refuses an unknown templateId with a 400', async () => {
    const error = await send({ ...base, templateId: 999 }).catch((e: unknown) => e)
    expect(isDomainError(error) && [error.status, error.code]).toEqual([400, 'validation_error'])
  })

  it('stores one message per version and answers their ids in order', async () => {
    const { response } = await send({
      ...base,
      to: undefined,
      messageVersions: [{ to: [{ email: 'a@x.io' }] }, { to: [{ email: 'b@x.io' }] }],
    })
    const { messageIds } = response.body as { messageIds: string[] }
    expect(messageIds).toHaveLength(2)
    const rows = await ctx.db
      .select({ id: messages.id, provider: messages.providerMessageId })
      .from(messages)
      .where(inArray(messages.providerMessageId, messageIds))
    const recipients = await ctx.db
      .select({ messageId: messageRecipients.messageId, email: messageRecipients.email })
      .from(messageRecipients)
      .where(
        inArray(
          messageRecipients.messageId,
          rows.map((r) => r.id),
        ),
      )
    const byProvider = new Map(rows.map((r) => [r.provider, r.id]))
    const emailOf = (provider: string) =>
      recipients.find((r) => r.messageId === byProvider.get(provider))?.email
    expect(messageIds.map(emailOf)).toEqual(['a@x.io', 'b@x.io'])
  })

  it('refuses any reuse of an idempotencyKey for 30 minutes, then accepts it (D279)', async () => {
    const key = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d'
    const first = await send(base, key)
    expect(first.replayed).toBe(false)
    for (const body of [base, { ...base, subject: 'Other' }]) {
      await expect(send(body, key.toUpperCase())).rejects.toMatchObject({
        code: 'idempotency_mismatch',
        message: expect.stringContaining('Request already processed'),
      })
    }
    const [record] = await ctx.db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.workspaceId, target.workspaceId))
    expect(record?.key).toBe(`brevo:${target.connectionId}:${key}`)
    const ttl = (record?.expiresAt.getTime() ?? 0) - Date.now()
    expect(ttl).toBeGreaterThan(29 * 60_000)
    expect(ttl).toBeLessThanOrEqual(30 * 60_000)
    await ctx.db.update(idempotencyKeys).set({ expiresAt: new Date(Date.now() - 1) })
    expect((await send(base, key)).replayed).toBe(false)
  })
})
