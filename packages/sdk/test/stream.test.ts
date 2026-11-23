import { describeDb } from '@mailsink/db/testing'
import { expect, it } from 'vitest'
import { isMailsinkError, type StreamEvent, type StreamFrame } from '../src'
import { useHarness } from './harness'

/** Collects stream events; `until` resolves once one matches. */
function collector() {
  const events: { event: StreamEvent; frame: StreamFrame }[] = []
  const waiters: (() => void)[] = []
  return {
    events,
    handler: (event: StreamEvent, frame: StreamFrame) => {
      events.push({ event, frame })
      for (const w of waiters.splice(0)) w()
    },
    async until(match: (event: StreamEvent) => boolean, timeout = 5_000) {
      const deadline = Date.now() + timeout
      while (!events.some((e) => match(e.event))) {
        if (Date.now() > deadline) throw new Error('stream event not received')
        await new Promise<void>((resolve) => {
          waiters.push(resolve)
          setTimeout(resolve, 50)
        })
      }
      return events.find((e) => match(e.event)) as (typeof events)[number]
    },
  }
}

const created = (subject: string) => (e: StreamEvent) =>
  e.type === 'message.created' && e.message.subject === subject

describeDb('SDK stream', (ctx) => {
  const h = useHarness(ctx)

  it('receives typed events and replays the missed ones after a drop (Last-Event-ID)', async () => {
    const c = collector()
    const errors: unknown[] = []
    const sub = h.sink.stream.subscribe(c.handler, {
      types: ['message.created'],
      retryMs: 300,
      onError: (e) => errors.push(e),
    })
    await sub.ready
    await h.send({ subject: 'Before drop' })
    const first = await c.until(created('Before drop'))
    expect(first.frame.id).toMatch(/^evt_/)
    expect(sub.lastEventId).toBe(first.frame.id)

    h.server.dropConnections()
    await h.send({ subject: 'During drop' })
    await c.until(created('During drop'))
    const streams = h.server.seen.filter((s) => s.path === '/capture/stream')
    expect(streams.length).toBeGreaterThanOrEqual(2)
    expect(streams.at(-1)?.headers.get('last-event-id')).toBe(first.frame.id)
    expect(c.events.filter((e) => created('Before drop')(e.event))).toHaveLength(1)
    expect(c.events.filter((e) => created('During drop')(e.event))).toHaveLength(1)
    expect(c.events.every((e) => e.event.type === 'message.created')).toBe(true)
    expect(errors.length).toBeGreaterThan(0)

    sub.close()
    await sub.done
  })

  it('sends the filters and stops after workspace.deleted', async () => {
    const ws = await h.admin.admin.workspaces.create({ name: 'Doomed', ephemeral: true })
    const doomed = h.admin.with({ key: ws.workspaceKey, adminKey: undefined })
    const c = collector()
    const sub = doomed.stream.subscribe(c.handler, {
      types: ['messages.purged'],
      connectionId: h.connectionId,
    })
    await sub.ready
    const request = h.server.seen.filter((s) => s.path === '/capture/stream').at(-1)
    expect(request?.query.get('types')).toBe('messages.purged')
    expect(request?.query.get('connectionId')).toBe(h.connectionId)
    await doomed.messages.purge()
    await c.until((e) => e.type === 'messages.purged')
    await h.admin.admin.workspaces.delete(ws.workspace.id)
    await sub.done
    expect(c.events.at(-1)?.event).toEqual({
      type: 'workspace.deleted',
      workspaceId: ws.workspace.id,
    })
  })

  it('rejects ready and done when the key is refused, without retrying', async () => {
    const errors: unknown[] = []
    const bad = h.admin.with({ key: 'mskw_not-a-valid-key-0000', adminKey: undefined })
    const sub = bad.stream.subscribe(() => {}, { onError: (e) => errors.push(e), retryMs: 10 })
    const failure = await sub.ready.catch((e: unknown) => e)
    expect(isMailsinkError(failure, 'unauthorized')).toBe(true)
    await expect(sub.done).rejects.toMatchObject({ code: 'unauthorized', status: 401 })
    expect(errors).toHaveLength(1)
  })
})
