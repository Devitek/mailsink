import { describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../../runtime/boot'
import type { Runtime } from '../../runtime/container'
import { listMessages } from '../capture/api'
import { postEmail } from '../native/emails'
import { ADMIN_KEY, installTestRuntime, request, seedWorkspace } from '../test-fixtures'
import { getAdminApiLogApi, listAdminApiLogsApi } from './logs'

describeDb('Admin API logs without workspace', (ctx) => {
  let runtime: Runtime
  let a: Awaited<ReturnType<typeof seedWorkspace>>
  beforeAll(async () => {
    runtime = await installTestRuntime(ctx.handle)
    a = await seedWorkspace(ctx.db)
  })
  afterAll(() => stopRuntime())

  const list = (query: string, bearer = ADMIN_KEY) =>
    listAdminApiLogsApi({ request: request(`/admin/logs/api${query}`, { bearer }) })
  const detail = (id: string) =>
    getAdminApiLogApi({
      request: request(`/admin/logs/api/${id}`, { bearer: ADMIN_KEY }),
      params: { id },
    })

  it('lists and reads only the rows without workspace, admin key required', async () => {
    const denied = await postEmail({
      request: request('/v1/emails', {
        method: 'POST',
        bearer: 'msk_nope',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ from: 'a@x.io', to: 'b@x.io', subject: 'Hi', text: 'x' }),
      }),
    })
    const owned = await listMessages({
      request: request('/capture/messages', { bearer: a.workspaceKey }),
    })
    await runtime.logs.flush()
    const deniedId = denied.headers.get('x-request-id') ?? ''
    const ownedId = owned.headers.get('x-request-id') ?? ''

    const res = await list('?status=4xx&pageSize=100')
    expect(res.status).toBe(200)
    const page = await res.json()
    const ids = page.data.map((l: { id: string }) => l.id)
    expect(ids).toContain(deniedId)
    expect(ids).not.toContain(ownedId)

    const row = await detail(deniedId)
    expect(row.status).toBe(200)
    expect(await row.json()).toMatchObject({ id: deniedId, statusCode: 401 })
    expect((await detail(ownedId)).status).toBe(404)

    expect((await list('', a.workspaceKey)).status).toBe(401)
    // Reading the logs is not logged (D145).
    await runtime.logs.flush()
    const again = await (await list('?dialect=admin&pageSize=100')).json()
    expect(again.data.some((l: { path: string }) => l.path.startsWith('/admin/logs'))).toBe(false)
  })
})
