import { workspaces } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../../runtime/boot'
import type { Runtime } from '../../runtime/container'
import { postEmail } from '../native/emails'
import { installTestRuntime, request, seedWorkspace } from '../test-fixtures'
import { listMessages } from './api'
import { streamEvents } from './stream'
import { openEventStream } from './stream-sse'

type Seeded = Awaited<ReturnType<typeof seedWorkspace>>

/** Reads an SSE body as text; `until` resolves once the text read so far matches. */
function sse(body: ReadableStream<Uint8Array> | null) {
  if (!body) throw new Error('no body')
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const state = { text: '', done: false }
  return {
    state,
    async until(match: (text: string) => boolean) {
      while (!match(state.text) && !state.done) {
        const { done, value } = await reader.read()
        state.done = done
        if (value) state.text += decoder.decode(value)
      }
      return state.text
    },
    close: () => reader.cancel(),
  }
}
const dataOf = (text: string) =>
  text
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => JSON.parse(l.slice(6)))
const idsOf = (text: string) =>
  text
    .split('\n')
    .filter((l) => l.startsWith('id: '))
    .map((l) => l.slice(4))

describeDb('Capture stream (SSE) and wait=true over HTTP', (ctx) => {
  let runtime: Runtime
  let a: Seeded
  beforeAll(async () => {
    runtime = await installTestRuntime(ctx.handle)
    a = await seedWorkspace(ctx.db)
  })
  afterAll(() => stopRuntime())

  const send = (subject: string, seed = a) =>
    postEmail({
      request: request('/v1/emails', {
        method: 'POST',
        bearer: seed.connectionKey,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ from: 'app@x.io', to: 'jane@x.io', subject, text: 'hi' }),
      }),
    })
  const open = (qs = '', headers: Record<string, string> = {}, signal?: AbortSignal) =>
    streamEvents({
      request: request(`/capture/stream${qs}`, { bearer: a.workspaceKey, headers, signal }),
    })

  it('streams message.created for a message sent after connecting', async () => {
    const controller = new AbortController()
    const res = await open('', {}, controller.signal)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const stream = sse(res.body)
    await stream.until((t) => t.includes(': connected'))
    await send('Live one')
    const text = await stream.until((t) => t.includes('Live one'))
    const created = dataOf(text).find((e) => e.type === 'message.created')
    expect(created.message).toMatchObject({ subject: 'Live one', status: 'queued' })
    expect(idsOf(text)[0]).toMatch(/^evt_/)
    controller.abort()
  })

  it('replays what was missed after Last-Event-ID, filtered by type', async () => {
    const first = sse((await open()).body)
    await first.until((t) => t.includes(': connected'))
    await send('Before')
    const lastId = idsOf(await first.until((t) => t.includes('Before'))).at(-1) ?? ''
    await first.close()
    await send('Missed')
    const again = sse((await open('?types=message.created', { 'Last-Event-ID': lastId })).body)
    const text = await again.until((t) => t.includes('Missed'))
    expect(dataOf(text).map((e) => e.message?.subject)).toEqual(['Missed'])
    await again.close()
  })

  it('rejects an unknown type filter and missing credentials', async () => {
    expect((await open('?types=nope')).status).toBe(422)
    expect((await streamEvents({ request: request('/capture/stream') })).status).toBe(401)
  })

  it('sends heartbeats and closes on workspace.deleted', async () => {
    const body = openEventStream({
      db: ctx.db,
      bus: runtime.bus,
      workspaceId: a.workspace.id,
      filter: {},
      lastEventId: null,
      heartbeatMs: 10,
    })
    const stream = sse(body)
    await stream.until((t) => t.includes(': ping'))
    runtime.bus.publish(a.workspace.id, {
      id: null,
      connectionId: null,
      event: { type: 'workspace.deleted', workspaceId: a.workspace.id },
    })
    const text = await stream.until(() => false)
    expect(stream.state.done).toBe(true)
    expect(dataOf(text).at(-1)).toEqual({
      type: 'workspace.deleted',
      workspaceId: a.workspace.id,
    })
  })

  it('wait=true answers the message sent while waiting, 408 when none comes', async () => {
    const wait = (qs: string) =>
      listMessages({ request: request(`/capture/messages?${qs}`, { bearer: a.workspaceKey }) })
    const pending = wait('wait=true&timeout=5000&subject=awaited')
    await new Promise((r) => setTimeout(r, 30))
    await send('The awaited one')
    const res = await pending
    expect(res.status).toBe(200)
    expect((await res.json()).data.map((m: { subject: string }) => m.subject)).toEqual([
      'The awaited one',
    ])
    const timeout = await wait('wait=true&timeout=50&subject=never')
    expect(timeout.status).toBe(408)
    expect((await timeout.json()).error.code).toBe('wait_timeout')
  })

  it('touches the workspace activity on authenticated calls', async () => {
    await ctx.db
      .update(workspaces)
      .set({ lastActivityAt: new Date(0) })
      .where(eq(workspaces.id, a.workspace.id))
    runtime.activity.forget(a.workspace.id)
    await listMessages({ request: request('/capture/messages', { bearer: a.workspaceKey }) })
    const [row] = await ctx.db.select().from(workspaces).where(eq(workspaces.id, a.workspace.id))
    expect(Date.now() - (row?.lastActivityAt.getTime() ?? 0)).toBeLessThan(5_000)
  })
})
