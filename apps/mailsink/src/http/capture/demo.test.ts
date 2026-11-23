import { describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../../runtime/boot'
import { installTestRuntime, request, seedWorkspace } from '../test-fixtures'
import { listMessages } from './api'
import { seedDemoApi } from './demo'

describeDb('Demo messages over HTTP', (ctx) => {
  let a: Awaited<ReturnType<typeof seedWorkspace>>
  beforeAll(async () => {
    await installTestRuntime(ctx.handle)
    a = await seedWorkspace(ctx.db)
  })
  afterAll(() => stopRuntime())

  const post = (body: unknown, bearer = a.workspaceKey) =>
    seedDemoApi({
      request: request('/capture/demo', {
        method: 'POST',
        bearer,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    })

  it('seeds the data set in the locale asked, 201, readable through the Capture API', async () => {
    const res = await post({ locale: 'fr' })
    expect(res.status).toBe(201)
    const seeded = await res.json()
    expect(seeded.count).toBe(8)
    const list = await listMessages({
      request: request('/capture/messages?limit=50', { bearer: a.workspaceKey }),
    })
    const page = await list.json()
    expect(page.data.map((m: { id: string }) => m.id).sort()).toEqual([...seeded.messageIds].sort())
    expect(page.data.map((m: { subject: string }) => m.subject)).toContain(
      'Votre facture INV-2026-0142',
    )
  })

  it('refuses an unknown locale (422) and an anonymous call (401)', async () => {
    expect((await post({ locale: 'de' })).status).toBe(422)
    expect((await post({}, 'mskw_nope-nope-nope-nope')).status).toBe(401)
  })
})
