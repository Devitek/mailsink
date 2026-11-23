import { ListApiLogsQuery, ListSmtpSessionsQuery } from '@mailsink/contracts'
import { newId } from '@mailsink/db'
import {
  createTestWorkspace,
  createTestWorkspaceWithConnection,
  describeDb,
} from '@mailsink/db/testing'
import { beforeEach, expect, it } from 'vitest'
import { createEventBus, type StreamFrame } from '../events'
import { getApiLogView, getSmtpSessionView, listApiLogViews, listSmtpSessionViews } from './query'
import { createLogWriter } from './writer'

const msg = (n: number) => `msg_0192f3a4-7b1c-7d2e-8f00-00000000000${n}`

describeDb('log writer and log queries', (ctx) => {
  let workspaceId = ''
  let connectionId = ''
  let otherId = ''

  const entry = (patch: Record<string, unknown> = {}) => ({
    id: newId('req'),
    workspaceId,
    connectionId,
    dialect: 'native' as const,
    method: 'POST',
    path: '/v1/emails',
    statusCode: 200,
    durationMs: 5,
    requestHeaders: { 'content-type': 'application/json' },
    requestBody: { subject: 'Hi' },
    responseBody: { id: msg(1) },
    messageIds: [msg(1)],
    errorCode: null,
    ip: '127.0.0.1',
    ...patch,
  })

  beforeEach(async () => {
    const seeded = await createTestWorkspaceWithConnection(ctx.db)
    workspaceId = seeded.workspace.id
    connectionId = seeded.connection.id
    otherId = (await createTestWorkspace(ctx.db)).id
  })

  it('writes api logs asynchronously and publishes log.api on the workspace channel', async () => {
    const bus = createEventBus()
    const frames: StreamFrame[] = []
    bus.subscribe(workspaceId, (f) => frames.push(f))
    const writer = createLogWriter({ db: ctx.db, bus })
    const first = entry()
    writer.writeApiLog(first)
    writer.writeApiLog(entry({ workspaceId: null, connectionId: null, dialect: 'admin' }))
    await writer.flush()
    expect(frames).toHaveLength(1)
    expect(frames[0]).toMatchObject({
      id: null,
      connectionId,
      event: { type: 'log.api', log: { id: first.id, statusCode: 200, messageIds: [msg(1)] } },
    })
    const detail = await getApiLogView(ctx.db, workspaceId, first.id)
    expect(detail).toMatchObject({ requestBody: { subject: 'Hi' }, ip: '127.0.0.1' })
    await expect(getApiLogView(ctx.db, otherId, first.id)).rejects.toMatchObject({
      code: 'not_found',
    })
  })

  it('logs a failed write instead of throwing, drops rows of a deleted workspace', async () => {
    const errors: unknown[] = []
    const writer = createLogWriter({ db: ctx.db, log: { error: (...a) => errors.push(a) } })
    writer.writeApiLog(entry({ workspaceId: newId('ws') })) // workspace gone: dropped silently
    writer.writeApiLog(entry({ statusCode: 'oops' })) // any other failure is logged
    await writer.flush()
    expect(errors).toHaveLength(1)
  })

  it('filters, sorts and pages api logs with the total', async () => {
    const writer = createLogWriter({ db: ctx.db })
    writer.writeApiLog(entry({ statusCode: 429, errorCode: 'rate_limited', durationMs: 1 }))
    writer.writeApiLog(entry({ statusCode: 502, errorCode: 'chaos_injected', durationMs: 9 }))
    writer.writeApiLog(
      entry({ dialect: 'capture', method: 'GET', path: '/capture/messages', messageIds: [] }),
    )
    writer.writeApiLog(entry({ workspaceId: otherId, connectionId: null }))
    await writer.flush()
    const list = (q: Record<string, unknown>) =>
      listApiLogViews(ctx.db, workspaceId, ListApiLogsQuery.parse(q))

    expect((await list({})).total).toBe(3)
    expect((await list({ status: '4xx,5xx' })).data.map((l) => l.statusCode).sort()).toEqual([
      429, 502,
    ])
    expect((await list({ errorCode: 'chaos_injected' })).data).toHaveLength(1)
    expect((await list({ dialect: 'capture', method: 'get' })).data[0]?.path).toBe(
      '/capture/messages',
    )
    expect((await list({ path: 'CAPTURE' })).total).toBe(1)
    expect((await list({ messageId: msg(1) })).total).toBe(2)
    const sorted = await list({ sort: '-durationMs', pageSize: 2, page: 1 })
    expect(sorted).toMatchObject({ total: 3, page: 1, pageSize: 2 })
    expect(sorted.data.map((l) => l.durationMs)).toEqual([9, 5])
    expect((await list({ sort: '-durationMs', pageSize: 2, page: 2 })).data[0]?.durationMs).toBe(1)
  })

  it('records smtp sessions capped and redacted, then lists and reads them', async () => {
    const bus = createEventBus()
    const frames: StreamFrame[] = []
    bus.subscribe(workspaceId, (f) => frames.push(f))
    const writer = createLogWriter({ db: ctx.db, bus })
    const startedAt = new Date('2026-11-23T10:00:00Z')
    await writer.recordSmtpSession({
      workspaceId,
      connectionId,
      remoteAddress: '10.0.0.7',
      clientHostname: 'laptop.local',
      authUser: 'smtp-user',
      secure: false,
      transcript: [{ at: 1, dir: 'C', line: 'AUTH PLAIN c2VjcmV0' }],
      messageIds: [msg(2)],
      outcome: 'accepted',
      startedAt,
      endedAt: new Date('2026-11-23T10:00:01Z'),
    })
    await writer.recordSmtpSession({
      remoteAddress: '10.0.0.8',
      secure: true,
      transcript: [],
      messageIds: [],
      outcome: 'auth_failed',
      error: 'Invalid credentials',
      startedAt,
      endedAt: startedAt,
    })
    expect(frames.map((f) => f.event.type)).toEqual(['log.smtp'])
    const page = await listSmtpSessionViews(
      ctx.db,
      workspaceId,
      ListSmtpSessionsQuery.parse({ q: 'LAPTOP', outcome: 'accepted' }),
    )
    expect(page).toMatchObject({
      total: 1,
      data: [{ authUser: 'smtp-user', messageIds: [msg(2)] }],
    })
    const id = page.data[0]?.id ?? ''
    const detail = await getSmtpSessionView(ctx.db, workspaceId, id)
    expect(detail.transcript).toEqual([{ at: 1, dir: 'C', line: 'AUTH PLAIN [redacted]' }])
    expect(detail.endedAt).toBe('2026-11-23T10:00:01.000Z')
  })
})
