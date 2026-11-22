import { insertCapturedMessage } from '@mailsink/core/capture-testing'
import { describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../../runtime/boot'
import { ADMIN_KEY, installTestRuntime, request, seedWorkspace } from '../test-fixtures'
import { getAttachment, getMessage, getRawMessage, listMessages, purgeMessages } from './api'

type Seeded = Awaited<ReturnType<typeof seedWorkspace>>

describeDb('Capture API over HTTP', (ctx) => {
  let a: Seeded
  let b: Seeded
  let msgA: { id: string; attachmentIds: string[] }
  let msgB: { id: string; attachmentIds: string[] }

  beforeAll(async () => {
    await installTestRuntime(ctx.handle)
    a = await seedWorkspace(ctx.db)
    b = await seedWorkspace(ctx.db)
    const fixture = (subject: string) => ({
      subject,
      raw: `Subject: ${subject}\r\n\r\nbody\r\n`,
      attachments: [
        { filename: 'résumé "v2".html', contentType: 'text/html', content: '<script>x</script>' },
      ],
    })
    msgA = await insertCapturedMessage(ctx.db, a.workspace.id, fixture('From A'))
    msgB = await insertCapturedMessage(ctx.db, b.workspace.id, fixture('From B'))
  })
  afterAll(() => stopRuntime())

  const get = (path: string, bearer?: string, headers?: Record<string, string>) =>
    request(path, { bearer, headers })
  const paths = (m: { id: string; attachmentIds: string[] }) => ({
    detail: `/capture/messages/${m.id}`,
    raw: `/capture/messages/${m.id}/raw`,
    att: `/capture/messages/${m.id}/attachments/${m.attachmentIds[0]}`,
  })
  const call = {
    detail: (r: Request, m: { id: string }) => getMessage({ request: r, params: { id: m.id } }),
    raw: (r: Request, m: { id: string }) => getRawMessage({ request: r, params: { id: m.id } }),
    att: (r: Request, m: { id: string; attachmentIds: string[] }) =>
      getAttachment({ request: r, params: { id: m.id, attId: m.attachmentIds[0] ?? '' } }),
  }

  it('accepts msk_, mskw_ and the admin key with X-Mailsink-Workspace', async () => {
    for (const req of [
      get('/capture/messages', a.connectionKey),
      get('/capture/messages', a.workspaceKey),
      get('/capture/messages', ADMIN_KEY, { 'X-Mailsink-Workspace': a.workspace.slug }),
    ]) {
      const res = await listMessages({ request: req })
      expect(res.status).toBe(200)
      expect((await res.json()).data.map((m: { id: string }) => m.id)).toEqual([msgA.id])
    }
  })

  it('rejects missing, revoked and mismatched credentials', async () => {
    expect((await listMessages({ request: get('/capture/messages') })).status).toBe(401)
    expect((await listMessages({ request: get('/capture/messages', a.revokedKey) })).status).toBe(
      401,
    )
    const admin = await listMessages({ request: get('/capture/messages', ADMIN_KEY) })
    expect(admin.status).toBe(400)
    const crossed = get('/capture/messages', a.workspaceKey, {
      'X-Mailsink-Workspace': b.workspace.id,
    })
    expect((await listMessages({ request: crossed })).status).toBe(403)
  })

  it('never lets workspace A read, download or purge workspace B (404, not 403)', async () => {
    const p = paths(msgB)
    for (const key of [a.connectionKey, a.workspaceKey]) {
      for (const [res, code] of [
        [await call.detail(get(p.detail, key), msgB), 'not_found'],
        [await call.raw(get(p.raw, key), msgB), 'not_found'],
        [await call.att(get(p.att, key), msgB), 'not_found'],
      ] as const) {
        expect(res.status).toBe(404)
        expect((await res.json()).error.code).toBe(code)
      }
    }
    const purge = request(`/capture/messages?connectionId=${b.connection.id}`, {
      method: 'DELETE',
      bearer: a.workspaceKey,
    })
    expect(await (await purgeMessages({ request: purge })).json()).toEqual({ count: 0 })
    const stillThere = await call.detail(get(p.detail, b.workspaceKey), msgB)
    expect(stillThere.status).toBe(200)
  })

  it('returns the message detail', async () => {
    const res = await call.detail(get(paths(msgA).detail, a.workspaceKey), msgA)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      id: msgA.id,
      subject: 'From A',
      webhookDeliveries: [], // filled by #33
    })
  })

  it('serves the raw EML as message/rfc822', async () => {
    const res = await call.raw(get(paths(msgA).raw, a.connectionKey), msgA)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('message/rfc822')
    expect(res.headers.get('content-disposition')).toBe(
      `attachment; filename="${msgA.id}.eml"; filename*=UTF-8''${msgA.id}.eml`,
    )
    expect(await res.text()).toBe('Subject: From A\r\n\r\nbody\r\n')
  })

  it('serves an attachment with its type, disposition and a sandbox CSP', async () => {
    const res = await call.att(get(paths(msgA).att, a.workspaceKey), msgA)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/html')
    expect(res.headers.get('content-disposition')).toBe(
      `attachment; filename="r_sum_ _v2_.html"; filename*=UTF-8''r%C3%A9sum%C3%A9%20%22v2%22.html`,
    )
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('content-security-policy')).toContain('sandbox')
    expect(res.headers.get('x-request-id')).toMatch(/^req_/)
    expect(await res.text()).toBe('<script>x</script>')
  })

  it('validates the query: 422 on bad status, bad cursor and timeout', async () => {
    for (const [qs, field] of [
      ['status=nope', 'status'],
      ['cursor=garbage', 'cursor'],
      ['wait=true&timeout=40000', 'timeout'],
      ['since=2026-11-02T00:00:00Z&until=2026-11-01T00:00:00Z', 'until'],
    ] as const) {
      const res = await listMessages({ request: get(`/capture/messages?${qs}`, a.workspaceKey) })
      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error.code).toBe('validation_error')
      expect(body.error.details.issues[0].path[0]).toBe(field)
    }
  })

  it('purges the workspace messages', async () => {
    const extra = await insertCapturedMessage(ctx.db, a.workspace.id)
    const res = await purgeMessages({
      request: request('/capture/messages?includeLogs=false', {
        method: 'DELETE',
        bearer: a.workspaceKey,
      }),
    })
    expect(await res.json()).toEqual({ count: 2 })
    expect(
      (await call.detail(get(`/capture/messages/${extra.id}`, a.workspaceKey), extra)).status,
    ).toBe(404)
  })
})
