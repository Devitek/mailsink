import { describeDb } from '@mailsink/db/testing'
import { expect, it } from 'vitest'
import { isMailsinkError } from '../src'
import { useHarness } from './harness'

const bounceAll = { rules: [{ match: '*', status: 'hard_bounce' as const }] }

describeDb('SDK overrides, suppressions, webhooks and logs', (ctx) => {
  const h = useHarness(ctx)

  it('activates, reads and resets an override', async () => {
    const state = await h.sink.overrides.activate(bounceAll, { ttl: '1h' })
    expect(state.workspace?.config.rules).toHaveLength(1)
    expect(state.workspace?.expiresAt).not.toBeNull()
    expect((await h.sink.overrides.get()).workspace).not.toBeNull()
    expect((await h.sink.overrides.reset()).workspace).toBeNull()
  })

  it('with() resets the override after the callback, even when it throws', async () => {
    const seen = await h.sink.overrides.with(bounceAll, async () => {
      return (await h.sink.overrides.get()).workspace?.config
    })
    expect(seen).toMatchObject(bounceAll)
    expect((await h.sink.overrides.get()).workspace).toBeNull()

    const failure = await h.sink.overrides
      .with(
        bounceAll,
        () => {
          throw new Error('boom')
        },
        { connectionId: h.connectionId },
      )
      .catch((e: unknown) => e)
    expect((failure as Error).message).toBe('boom')
    expect((await h.sink.overrides.get()).connections).toEqual([])
  })

  it('lists, deletes and clears suppressions', async () => {
    for (const to of ['a@example.com', 'b@example.com']) {
      const id = await h.send({ to, subject: 'Bounce' })
      await h.sink.messages.triggerEvent(id, { type: 'status', status: 'hard_bounce' })
    }
    const page = await h.sink.suppressions.list()
    expect(page.total).toBe(2)
    expect((await h.sink.suppressions.list({ email: 'a@' })).data.map((s) => s.email)).toEqual([
      'a@example.com',
    ])
    expect(await h.sink.suppressions.delete('a@example.com')).toEqual({ count: 1 })
    expect(await h.sink.suppressions.clear()).toEqual({ count: 1 })
  })

  it('manages webhook endpoints, the delivery log and replays', async () => {
    const created = await h.sink.webhooks.create({
      connectionId: null,
      url: `${h.server.url}/hook`,
      events: ['email.delivered'],
    })
    expect(created.secret).toMatch(/^whsec_/)
    expect((await h.sink.webhooks.list()).data.map((e) => e.id)).toEqual([created.id])
    expect((await h.sink.webhooks.get(created.id)).url).toBe(`${h.server.url}/hook`)
    const rotated = await h.sink.webhooks.update(created.id, { rotateSecret: true })
    expect(rotated.secret).not.toBe(created.secret)

    const preview = await h.sink.webhooks.preview({
      payloadFormat: 'unified',
      event: 'email.delivered',
    })
    expect(preview.body).toBeDefined()

    const sample = await h.sink.webhooks.test(created.id)
    const page = await h.sink.webhooks.deliveries.list({ endpointId: created.id })
    expect(page.data.map((d) => d.id)).toEqual([sample.id])
    expect((await h.sink.webhooks.deliveries.get(sample.id)).attempts.length).toBeGreaterThan(0)
    const replay = await h.sink.webhooks.deliveries.replay(sample.id, { mode: 'resign' })
    expect(replay.replayOf).toBe(sample.id)

    expect(await h.sink.webhooks.delete(created.id)).toEqual({ id: created.id })
  })

  it('reads the API and SMTP logs of the workspace', async () => {
    await h.send({ subject: 'Logged' })
    const api = await h.sink.logs.api.list({ method: 'POST' })
    const row = api.data.find((r) => r.path === '/v1/emails')
    if (!row) throw new Error('no log row')
    expect((await h.sink.logs.api.get(row.id)).id).toBe(row.id)
    expect((await h.sink.logs.smtp.list()).data).toEqual([])
    const missing = await h.sink.logs.smtp.get('smtp_missing').catch((e: unknown) => e)
    expect(isMailsinkError(missing, 'not_found')).toBe(true)
  })
})
