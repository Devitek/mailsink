import { BASE_URL } from '../web-server'
import { adminContext, createWorkspace, deleteWorkspace, expect, test } from './fixtures'

// Real time on the built server (#81): the SSE stream and wait=true long polling.

type StreamEvent = { type: string; [key: string]: unknown }

/** Opens `GET /capture/stream` and parses its `data:` frames as they arrive. */
async function openStream(workspaceKey: string) {
  const controller = new AbortController()
  const res = await fetch(`${BASE_URL}/capture/stream`, {
    headers: { authorization: `Bearer ${workspaceKey}` },
    signal: controller.signal,
  })
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toContain('text/event-stream')
  const reader = (res.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  const events: StreamEvent[] = []
  let text = ''
  let ended = false
  let connected = false
  const read = async () => {
    const { done, value } = await reader.read()
    ended = done
    text += value ? decoder.decode(value, { stream: true }) : ''
    for (let end = text.indexOf('\n\n'); end >= 0; end = text.indexOf('\n\n')) {
      const lines = text.slice(0, end).split('\n')
      if (lines.includes(': connected')) connected = true
      const data = lines.find((l) => l.startsWith('data: '))
      if (data) events.push(JSON.parse(data.slice(6)))
      text = text.slice(end + 2)
    }
  }
  return {
    events,
    ended: () => ended,
    /** Reads until an event of `type` arrived (or the stream ended), then returns it. */
    async next(type: string): Promise<StreamEvent | undefined> {
      while (!events.some((e) => e.type === type) && !ended) await read()
      return events.find((e) => e.type === type)
    },
    async connected() {
      while (!connected && !ended) await read()
    },
    close: () => controller.abort(),
  }
}

test('the SSE stream carries messages, statuses, overrides and the deletion', async ({
  playwright,
}) => {
  const admin = await adminContext(playwright)
  const ws = await createWorkspace(playwright, admin, 'e2e-stream')
  const stream = await openStream(ws.workspaceKey)
  try {
    await stream.connected()
    const id = await ws.send({
      from: 'app@example.com',
      to: 'jane@example.com',
      subject: 'Hi',
      text: 'x',
    })

    expect(await stream.next('message.created')).toMatchObject({ message: { id, subject: 'Hi' } })
    expect(await stream.next('message.status')).toMatchObject({
      messageId: id,
      status: 'delivered',
      recipient: null,
    })
    const events = stream.events.filter((e) => e.type === 'message.event')
    expect(events.map((e) => (e.event as { type: string }).type)).toEqual(['sent', 'delivered'])

    await ws.capture.post('/capture/override', { data: { config: { rates: { failed: 100 } } } })
    expect(await stream.next('override.changed')).toMatchObject({
      state: { workspace: { config: { rates: { failed: 100 } } } },
    })

    expect((await deleteWorkspace(admin, ws.id)).status()).toBe(204)
    expect(await stream.next('workspace.deleted')).toEqual({
      type: 'workspace.deleted',
      workspaceId: ws.id,
    })
    await stream.next('end of stream') // reads until the server closes it
    expect(stream.ended()).toBe(true)
    expect(stream.events.at(-1)?.type).toBe('workspace.deleted')
  } finally {
    stream.close()
    await ws.dispose()
    await admin.dispose()
  }
})

test('wait=true returns as soon as a message matches, 408 otherwise', async ({ playwright }) => {
  const admin = await adminContext(playwright)
  const ws = await createWorkspace(playwright, admin, 'e2e-wait')
  try {
    const since = new Date().toISOString()
    const started = Date.now()
    const waiting = ws.capture.get('/capture/messages', {
      params: { wait: true, since, subject: 'Later', timeout: 15_000 },
    })
    setTimeout(() => {
      void ws.send({ from: 'app@example.com', to: 'jane@example.com', subject: 'Later', text: 'x' })
    }, 500)
    const res = await waiting
    expect(res.status()).toBe(200)
    expect((await res.json()).data).toEqual([expect.objectContaining({ subject: 'Later' })])
    expect(Date.now() - started).toBeLessThan(10_000)

    const timedOut = await ws.capture.get('/capture/messages', {
      params: { wait: true, subject: 'Never', timeout: 300 },
    })
    expect(timedOut.status()).toBe(408)
    expect((await timedOut.json()).error.code).toBe('wait_timeout')
  } finally {
    await ws.dispose()
    await admin.dispose()
  }
})
