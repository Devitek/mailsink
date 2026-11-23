import { ListApiLogsQuery, ListSmtpSessionsQuery, ReplayRequest } from '@mailsink/contracts'
import { type StreamFrame, svixSignature } from '@mailsink/core'
import {
  insertApiLog,
  insertSmtpSession,
  insertWebhookAttempt,
  insertWebhookDeliveries,
  insertWebhookEndpoint,
  newId,
} from '@mailsink/db'
import { createTestWorkspaceWithConnection, describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { installTestRuntime } from '../http/test-fixtures'
import { stopRuntime } from '../runtime/boot'
import type { Runtime } from '../runtime/container'
import {
  readApiLog,
  readApiLogs,
  readDeliveries,
  readDelivery,
  readLogSources,
  readSmtpSession,
  readSmtpSessions,
  replayDelivery,
} from './logs.server'

const SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'
const BODY = '{"type":"email.delivered"}'

describeDb('UI logs explorer server functions', (ctx) => {
  let runtime: Runtime
  let ws: { id: string; slug: string }
  let con: string
  let deliveryId: string

  beforeAll(async () => {
    runtime = await installTestRuntime(ctx.handle)
    const seeded = await createTestWorkspaceWithConnection(ctx.db)
    ws = seeded.workspace
    con = seeded.connection.id
    const log = { workspaceId: ws.id, connectionId: con, method: 'POST', durationMs: 4 }
    await insertApiLog(ctx.db, {
      ...log,
      id: newId('req'),
      dialect: 'resend',
      path: '/emails',
      statusCode: 200,
      requestHeaders: { 'content-type': 'application/json' },
      requestBody: { to: 'julie@gmail.test' },
      responseBody: { id: 'abc' },
    })
    await insertApiLog(ctx.db, {
      ...log,
      id: newId('req'),
      dialect: 'native',
      path: '/v1/emails',
      statusCode: 429,
      errorCode: 'rate_limited',
    })
    await insertSmtpSession(ctx.db, {
      id: newId('smtp'),
      workspaceId: ws.id,
      connectionId: con,
      remoteAddress: '127.0.0.1',
      secure: false,
      transcript: [{ at: 1, dir: 'S', line: '220 mailsink ESMTP' }],
      outcome: 'auth_failed',
      startedAt: new Date(),
    })
    const endpoint = await insertWebhookEndpoint(ctx.db, {
      id: newId('whe'),
      workspaceId: ws.id,
      connectionId: con,
      url: 'https://hooks.example.test/resend',
      payloadFormat: 'resend',
      events: ['email.delivered'],
      secret: SECRET,
    })
    const [delivery] = await insertWebhookDeliveries(ctx.db, [
      {
        id: newId('whd'),
        workspaceId: ws.id,
        endpointId: endpoint.id,
        payloadFormat: 'resend',
        canonicalEvent: 'email.delivered',
        dialectEvent: 'email.delivered',
        body: BODY,
        status: 'succeeded',
        attemptCount: 1,
        lastStatusCode: 200,
      },
    ])
    deliveryId = delivery?.id ?? ''
    await insertWebhookAttempt(ctx.db, {
      id: newId('wha'),
      deliveryId,
      attemptNo: 1,
      requestHeaders: {
        'svix-id': deliveryId,
        'svix-timestamp': '1795430400',
        'svix-signature': svixSignature(SECRET, deliveryId, 1795430400, BODY),
      },
      signedAt: 1795430400,
      responseStatus: 200,
      durationMs: 12,
    })
  })
  afterAll(() => stopRuntime())

  it('lists the facet sources and the count of each tab', async () => {
    const sources = await readLogSources(runtime, ws.slug)
    expect(sources.counts).toEqual({ api: 2, smtp: 1, webhooks: 1 })
    expect(sources.connections.map((c) => c.id)).toEqual([con])
    expect(sources.endpoints).toEqual([
      expect.objectContaining({ url: 'https://hooks.example.test/resend', connectionId: con }),
    ])
  })

  it('reads the API log with filters and its detail with bodies as text', async () => {
    const all = await readApiLogs(runtime, ws.slug, ListApiLogsQuery.parse({}))
    expect(all.total).toBe(2)
    const errors = await readApiLogs(runtime, ws.slug, ListApiLogsQuery.parse({ status: '4xx' }))
    expect(errors.data.map((l) => l.errorCode)).toEqual(['rate_limited'])
    const ok = all.data.find((l) => l.statusCode === 200)
    const detail = await readApiLog(runtime, ws.slug, ok?.id ?? '')
    expect(JSON.parse(detail.requestBody ?? '')).toEqual({ to: 'julie@gmail.test' })
    expect(detail.responseBody).toContain('"id": "abc"')
  })

  it('reads the SMTP sessions and the transcript', async () => {
    const page = await readSmtpSessions(runtime, ws.slug, ListSmtpSessionsQuery.parse({}))
    expect(page.data.map((s) => s.outcome)).toEqual(['auth_failed'])
    const session = await readSmtpSession(runtime, ws.slug, page.data[0]?.id ?? '')
    expect(session.transcript[0]?.line).toBe('220 mailsink ESMTP')
  })

  it('reads a delivery with its endpoint and checks the signature of each attempt', async () => {
    const page = await readDeliveries(runtime, ws.slug, { payloadFormat: 'resend', limit: 50 })
    expect(page.data.map((d) => d.id)).toEqual([deliveryId])
    const detail = await readDelivery(runtime, ws.slug, deliveryId)
    expect(detail.body).toBe(BODY)
    expect(detail.endpoint).toMatchObject({ url: 'https://hooks.example.test/resend' })
    expect(detail.endpoint?.secretPreview).toBe('whsec_MfKQ…')
    expect(detail.attempts.map((a) => a.signature)).toEqual(['valid'])
  })

  it('replays a delivery and publishes it on the bus', async () => {
    const seen: StreamFrame[] = []
    const stop = runtime.bus.subscribe(ws.id, (f) => seen.push(f))
    const replay = await replayDelivery(
      runtime,
      ws.slug,
      deliveryId,
      ReplayRequest.parse({ mode: 'resign' }),
    )
    stop()
    expect(replay).toMatchObject({ replayOf: deliveryId, replayMode: 'resign', status: 'pending' })
    expect(seen.map((f) => f.event.type)).toEqual(['webhook.delivery'])
  })

  it('answers not found for an unknown slug or another workspace row', async () => {
    await expect(readLogSources(runtime, 'nope')).rejects.toMatchObject({ code: 'not_found' })
    const other = await createTestWorkspaceWithConnection(ctx.db)
    await expect(readDelivery(runtime, other.workspace.slug, deliveryId)).rejects.toMatchObject({
      code: 'not_found',
    })
  })
})
