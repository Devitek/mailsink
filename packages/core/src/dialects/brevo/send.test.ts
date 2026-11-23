import { BrevoSendRequest, type BrevoSendRequestInput, TemplateInput } from '@mailsink/contracts'
import { messageRecipients, messages } from '@mailsink/db'
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

  it('replays an Idempotency-Key', async () => {
    const first = await send(base, 'brevo-1')
    const again = await send(base, 'brevo-1')
    expect(again.replayed).toBe(true)
    expect(again.response.body).toEqual(first.response.body)
  })
})
