import type { StreamFrame } from '@mailsink/core'
import { apiLogs } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { stopRuntime } from '../runtime/boot'
import type { Runtime } from '../runtime/container'
import { whenRuntimeReady } from '../runtime/slot'
import { postWorkspace } from './admin/workspaces'
import { listMessages } from './capture/api'
import { getApiLogApi, listApiLogsApi } from './capture/logs'
import { postOverride, postOverrideReset } from './capture/override'
import { dialectOf, isLoggedCall } from './logs-extension'
import { postEmail } from './native/emails'
import { ADMIN_KEY, installTestRuntime, request } from './test-fixtures'

const email = {
  from: 'app@example.com',
  to: 'jane@x.io',
  subject: 'Hi',
  text: 'Hello',
  attachments: [{ filename: 'a.txt', content: 'SGVsbG8gd29ybGQ=' }],
}

describeDb('request log extension', (ctx) => {
  let runtime: Runtime
  let draws: number[] = []
  let workspaceKey = ''
  let connectionKey = ''
  let workspaceId = ''

  const json = (bearer: string, body: unknown) => ({
    method: 'POST',
    bearer,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const send = () => postEmail({ request: request('/v1/emails', json(connectionKey, email)) })
  const logsOf = async (requestId: string | null) => {
    await runtime.logs.flush()
    return ctx.db
      .select()
      .from(apiLogs)
      .where(eq(apiLogs.id, requestId ?? ''))
  }

  beforeAll(async () => {
    runtime = await installTestRuntime(
      ctx.handle,
      {},
      { chaosRandom: () => draws.shift() ?? 0.999 },
    )
    const res = await postWorkspace({
      request: request(
        '/admin/workspaces',
        json(ADMIN_KEY, { name: 'Logged', connections: [{ kind: 'resend', name: 'app' }] }),
      ),
    })
    const created = await res.json()
    workspaceKey = created.workspaceKey
    connectionKey = created.connections[0].credentials.apiKey
    workspaceId = created.workspace.id
    // The Admin creation call is logged without workspace and without its secrets.
    const [admin] = await logsOf(res.headers.get('x-request-id'))
    expect(admin).toMatchObject({ workspaceId: null, dialect: 'admin', statusCode: 201 })
    expect(JSON.stringify(admin?.responseBody)).not.toContain(workspaceKey)
  })
  afterAll(() => stopRuntime())
  beforeEach(async () => {
    draws = []
    await postOverrideReset({ request: request('/capture/override/reset', json(workspaceKey, {})) })
  })

  it('logs an ingestion call: redacted key, stripped attachment, message ids', async () => {
    const frames: StreamFrame[] = []
    const off = runtime.bus.subscribe(workspaceId, (f) => frames.push(f))
    const clone = vi.spyOn(Request.prototype, 'clone')
    const res = await send()
    expect(clone).not.toHaveBeenCalled() // the body is read once (D157)
    clone.mockRestore()
    expect(res.status).toBe(200)
    const { id } = await res.json()
    const [row] = await logsOf(res.headers.get('x-request-id'))
    off()
    expect(row).toMatchObject({
      workspaceId,
      dialect: 'native',
      method: 'POST',
      path: '/v1/emails',
      statusCode: 200,
      errorCode: null,
      messageIds: [id],
      responseBody: { id },
    })
    expect(row?.requestHeaders?.authorization).toBe('Bearer msk_[redacted]')
    expect(row?.requestBody).toMatchObject({
      subject: 'Hi',
      attachments: [{ filename: 'a.txt', content: '[omitted: 16 chars]' }],
    })
    expect(frames.map((f) => f.event.type)).toContain('log.api')
  })

  it('logs refused calls with their errorCode (chaos, auth failure)', async () => {
    await postOverride({
      request: request(
        '/capture/override',
        json(workspaceKey, { config: { chaos: { errorRate: 100, httpCodes: [502] } } }),
      ),
    })
    const chaos = await send()
    expect(chaos.status).toBe(502)
    const [row] = await logsOf(chaos.headers.get('x-request-id'))
    expect(row).toMatchObject({ statusCode: 502, errorCode: 'chaos_injected', messageIds: [] })
    expect(row?.requestBody).toMatchObject({ subject: 'Hi' })

    const denied = await postEmail({ request: request('/v1/emails', json('msk_nope', email)) })
    const [anonymous] = await logsOf(denied.headers.get('x-request-id'))
    expect(anonymous).toMatchObject({
      workspaceId: null,
      statusCode: 401,
      errorCode: 'unauthorized',
    })
    expect(anonymous?.requestBody).toBeNull() // anonymous bodies are never read
  })

  it('serves the logs through the Capture API without logging the log reads', async () => {
    const capture = await listMessages({
      request: request('/capture/messages', { bearer: workspaceKey }),
    })
    await runtime.logs.flush()
    const res = await listApiLogsApi({
      request: request('/capture/logs/api?dialect=capture&pageSize=100', { bearer: workspaceKey }),
    })
    expect(res.status).toBe(200)
    const page = await res.json()
    const ids = page.data.map((l: { id: string }) => l.id)
    expect(ids).toContain(capture.headers.get('x-request-id'))
    await runtime.logs.flush()
    expect(await logsOf(res.headers.get('x-request-id'))).toEqual([])
    const detail = await getApiLogApi({
      request: request(`/capture/logs/api/${ids[0]}`, { bearer: workspaceKey }),
      params: { id: ids[0] },
    })
    expect((await detail.json()).requestHeaders.authorization).toBe('Bearer mskw_[redacted]')
  })

  it('never fails the call when the write fails', async () => {
    const live = await whenRuntimeReady()
    const original = live.logs.writeApiLog
    live.logs.writeApiLog = () => {
      throw new Error('disk full')
    }
    try {
      expect((await send()).status).toBe(200)
    } finally {
      live.logs.writeApiLog = original
    }
  })
})

it('maps paths to dialects and skips log reads and the stream', () => {
  expect(dialectOf('/v1/emails')).toBe('native')
  expect(dialectOf('/emails/batch')).toBe('resend')
  expect(dialectOf('/v3/smtp/email')).toBe('brevo')
  expect(dialectOf('/admin/workspaces')).toBe('admin')
  expect(dialectOf('/mcp')).toBe('mcp')
  expect(dialectOf('/healthz')).toBeNull()
  expect(isLoggedCall('GET', '/capture/logs/api')).toBe(false)
  expect(isLoggedCall('GET', '/admin/logs/api')).toBe(false)
  expect(isLoggedCall('GET', '/admin/workspaces')).toBe(true)
  expect(isLoggedCall('GET', '/capture/stream')).toBe(false)
  expect(isLoggedCall('GET', '/capture/messages')).toBe(true)
  expect(isLoggedCall('DELETE', '/capture/messages')).toBe(true)
})
