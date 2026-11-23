import { simulateDelivery } from '@mailsink/core'
import { messages } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../../runtime/boot'
import { postEmail } from '../native/emails'
import { installTestRuntime, request, seedWorkspace } from '../test-fixtures'
import { postOverride } from './override'
import { deleteSuppressionsApi, listSuppressionsApi } from './suppressions'

describeDb('Suppression API over HTTP', (ctx) => {
  let a: Awaited<ReturnType<typeof seedWorkspace>>
  beforeAll(async () => {
    await installTestRuntime(ctx.handle)
    a = await seedWorkspace(ctx.db)
  })
  afterAll(() => stopRuntime())

  const json = (path: string, body: unknown, bearer: string) =>
    request(path, {
      method: 'POST',
      bearer,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  const send = async (to: string) => {
    const res = await postEmail({
      request: json(
        '/v1/emails',
        { from: 'app@x.io', to, subject: 'Hi', text: 'x' },
        a.connectionKey,
      ),
    })
    return (await res.json()).id as string
  }
  const list = async (query = '') =>
    (
      await listSuppressionsApi({
        request: request(`/capture/suppressions${query}`, { bearer: a.workspaceKey }),
      })
    ).json()
  const remove = async (query = '') =>
    deleteSuppressionsApi({
      request: request(`/capture/suppressions${query}`, {
        method: 'DELETE',
        bearer: a.workspaceKey,
      }),
    })

  it('suppresses a hard bounce, then marks the next send suppressed until reset', async () => {
    await postOverride({
      request: json(
        '/capture/override',
        { config: { rules: [{ match: '*+bounce@*', status: 'hard_bounce' }] } },
        a.workspaceKey,
      ),
    })
    const first = await send('jane+bounce@x.io')
    await simulateDelivery(ctx.db, first)
    expect(await list()).toMatchObject({
      data: [{ email: 'jane+bounce@x.io', reason: 'hard_bounce', messageId: first }],
      nextCursor: null,
    })

    const second = await send('jane+bounce@x.io')
    const [row] = await ctx.db.select().from(messages).where(eq(messages.id, second))
    expect(row?.status).toBe('suppressed')

    expect((await list('?email=JANE')).data).toHaveLength(1)
    const res = await remove('?email=Jane%2Bbounce@x.io')
    expect(await res.json()).toEqual({ count: 1 })
    expect((await list()).data).toEqual([])
  })

  it('resets the whole list and validates the email', async () => {
    expect((await remove('?email=not-an-email')).status).toBe(422)
    expect(await (await remove()).json()).toEqual({ count: 0 })
    expect(
      (
        await listSuppressionsApi({
          request: request('/capture/suppressions?cursor=bad', { bearer: a.workspaceKey }),
        })
      ).status,
    ).toBe(422)
  })
})
