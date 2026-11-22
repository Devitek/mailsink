import { MessageDetail } from '@mailsink/contracts'
import { createTestWorkspaceWithConnection, describeDb } from '@mailsink/db/testing'
import { beforeAll, expect, it } from 'vitest'
import { getCapturedMessage, readAttachment, readRawMessage } from './service'
import { insertCapturedMessage } from './testing/fixtures'

const RAW = 'From: app@example.com\r\nTo: jane@acme.io\r\nSubject: Hi\r\n\r\nHello\r\n'

describeDb('capture: detail, raw and attachments', (ctx) => {
  let ws: string
  let other: string
  let msg: { id: string; attachmentIds: string[] }

  beforeAll(async () => {
    ws = (await createTestWorkspaceWithConnection(ctx.db)).workspace.id
    other = (await createTestWorkspaceWithConnection(ctx.db)).workspace.id
    msg = await insertCapturedMessage(ctx.db, ws, {
      subject: 'Hi',
      to: [{ email: 'jane@acme.io', name: 'Jane' }],
      cc: ['cc@acme.io'],
      bcc: ['bcc@acme.io'],
      replyTo: [{ email: 'support@acme.io' }],
      headers: { 'X-Campaign': 'onboarding' },
      metadata: { userId: 42 },
      status: 'soft_bounce',
      raw: RAW,
      attachments: [
        { filename: 'invoice.pdf', contentType: 'application/pdf', content: '%PDF-1.7' },
        {
          filename: null,
          contentType: 'image/png',
          content: new Uint8Array([137, 80, 78, 71]),
          disposition: 'inline',
          contentId: 'logo@acme',
        },
      ],
      events: [
        { type: 'accepted', origin: 'api', occurredAt: new Date('2026-11-22T10:00:00Z') },
        {
          type: 'soft_bounce',
          origin: 'simulation',
          recipientEmail: 'jane@acme.io',
          data: { reason: 'mailbox full', smtpCode: 452 },
          occurredAt: new Date('2026-11-22T10:00:01Z'),
        },
      ],
    })
  })

  it('returns the full MessageDetail of the contract', async () => {
    const detail = await getCapturedMessage(ctx.db, ws, msg.id)
    const { webhookDeliveries: _, ...contractPart } = detail
    expect(MessageDetail.parse(detail)).toEqual(contractPart)
    const [pdf, png] = msg.attachmentIds
    expect(detail).toMatchObject({
      id: msg.id,
      subject: 'Hi',
      status: 'soft_bounce',
      to: [{ email: 'jane@acme.io', name: 'Jane' }],
      cc: [{ email: 'cc@acme.io', name: null }],
      bcc: [{ email: 'bcc@acme.io', name: null }],
      replyTo: [{ email: 'support@acme.io', name: null }],
      headers: { 'X-Campaign': 'onboarding' },
      metadata: { userId: 42 },
      hasAttachments: true,
      rawUrl: `/capture/messages/${msg.id}/raw`,
      simulation: null,
    })
    expect(detail.attachments).toEqual(
      expect.arrayContaining([
        {
          id: pdf,
          filename: 'invoice.pdf',
          contentType: 'application/pdf',
          contentId: null,
          sizeBytes: 8,
          inline: false,
          downloadUrl: `/capture/messages/${msg.id}/attachments/${pdf}`,
        },
        expect.objectContaining({ id: png, filename: null, inline: true, contentId: 'logo@acme' }),
      ]),
    )
    expect(detail.recipients.map((r) => [r.kind, r.email])).toEqual([
      ['to', 'jane@acme.io'],
      ['cc', 'cc@acme.io'],
      ['bcc', 'bcc@acme.io'],
    ])
    expect(detail.events.map((e) => e.type)).toEqual(['accepted', 'soft_bounce'])
    expect(detail.events[0]?.data).toEqual({})
    expect(detail.events[1]).toMatchObject({
      recipient: 'jane@acme.io',
      data: { reason: 'mailbox full', smtpCode: 452 },
    })
    // Filled by the webhook delivery issue (#33): always empty until then.
    expect(detail.webhookDeliveries).toEqual([])
  })

  it('serves the raw EML and the attachment bytes', async () => {
    expect(new TextDecoder().decode(await readRawMessage(ctx.db, ws, msg.id))).toBe(RAW)
    const png = await readAttachment(ctx.db, ws, msg.id, msg.attachmentIds[1] ?? '')
    expect(png).toMatchObject({ filename: null, contentType: 'image/png', disposition: 'inline' })
    expect([...png.data]).toEqual([137, 80, 78, 71])
  })

  it('answers not_found for a message without raw source', async () => {
    const bare = await insertCapturedMessage(ctx.db, ws)
    await expect(readRawMessage(ctx.db, ws, bare.id)).rejects.toMatchObject({ status: 404 })
  })

  it('never exposes another workspace: same 404 as a missing id', async () => {
    const [att] = msg.attachmentIds
    const notFound = { code: 'not_found', status: 404 }
    await expect(getCapturedMessage(ctx.db, other, msg.id)).rejects.toMatchObject(notFound)
    await expect(getCapturedMessage(ctx.db, ws, 'msg_missing')).rejects.toMatchObject(notFound)
    await expect(readRawMessage(ctx.db, other, msg.id)).rejects.toMatchObject(notFound)
    await expect(readAttachment(ctx.db, other, msg.id, att ?? '')).rejects.toMatchObject(notFound)
    // An attachment id paired with another message id of the same workspace.
    const sibling = await insertCapturedMessage(ctx.db, ws)
    await expect(readAttachment(ctx.db, ws, sibling.id, att ?? '')).rejects.toMatchObject(notFound)
  })
})
