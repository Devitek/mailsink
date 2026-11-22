import { describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { stopRuntime } from '../runtime/boot'
import { type BodyCap, DEFAULT_MAX_BODY_BYTES, limitBody, resolveBodyCap } from './body-limit'
import { defineApi } from './handler'
import { installTestRuntime, request, seedWorkspace } from './test-fixtures'

const streamed = (text: string) =>
  new Request('http://mailsink.test/x', {
    method: 'POST',
    body: new ReadableStream({
      start(controller) {
        for (const chunk of text.match(/.{1,4}/g) ?? []) controller.enqueue(Buffer.from(chunk))
        controller.close()
      },
    }),
    duplex: 'half',
  } as RequestInit)

describe('limitBody', () => {
  it('keeps a body under the cap readable', async () => {
    expect(await (await limitBody(streamed('{"a":1}'), 7)).text()).toBe('{"a":1}')
  })

  it('cuts a streamed body crossing the cap', async () => {
    await expect(limitBody(streamed('0123456789'), 9)).rejects.toMatchObject({
      code: 'payload_too_large',
      status: 413,
      details: { maxBytes: 9 },
    })
  })

  it('refuses a declared Content-Length above the cap without reading', async () => {
    const req = new Request('http://mailsink.test/x', {
      method: 'POST',
      headers: { 'content-length': '100' },
      body: 'x',
    })
    await expect(limitBody(req, 10)).rejects.toMatchObject({ code: 'payload_too_large' })
    expect(req.bodyUsed).toBe(false)
  })
})

describe('resolveBodyCap', () => {
  it('defaults to the small control-plane cap, not the message cap', () => {
    expect(resolveBodyCap(undefined, 26_214_400)).toBe(DEFAULT_MAX_BODY_BYTES)
    expect(DEFAULT_MAX_BODY_BYTES).toBe(1_048_576)
  })

  it("maps 'message' to MAILSINK_MAX_MESSAGE_BYTES and keeps explicit bytes", () => {
    expect(resolveBodyCap('message', 32)).toBe(32)
    expect(resolveBodyCap(64, 32)).toBe(64)
  })
})

describeDb('defineApi body cap', (ctx) => {
  let key: string
  beforeAll(async () => {
    await installTestRuntime(ctx.handle, { maxMessageBytes: 32 })
    key = (await seedWorkspace(ctx.db)).connectionKey
  })
  afterAll(() => stopRuntime())

  const route = (maxBodyBytes?: BodyCap) =>
    defineApi({
      auth: 'connection',
      body: z.object({ s: z.string() }),
      maxBodyBytes,
      handler: () => 'ok',
    })
  const post = (handler: ReturnType<typeof route>, s: string) =>
    handler({
      request: request('/x', { method: 'POST', bearer: key, body: JSON.stringify({ s }) }),
    })

  it("answers 413 payload_too_large above MAILSINK_MAX_MESSAGE_BYTES on 'message' routes", async () => {
    expect((await post(route('message'), 'short')).status).toBe(200)
    const res = await post(route('message'), 'x'.repeat(40))
    expect(res.status).toBe(413)
    expect((await res.json()).error).toEqual({
      code: 'payload_too_large',
      message: 'Request body exceeds the 32 bytes limit',
      details: { maxBytes: 32 },
    })
  })

  it('lets a route set its own cap', async () => {
    expect((await post(route(64), 'x'.repeat(40))).status).toBe(200)
    expect((await post(route(16), 'x'.repeat(10))).status).toBe(413)
  })

  it('applies the default cap, not the message cap, to routes that set none', async () => {
    expect((await post(route(), 'x'.repeat(40))).status).toBe(200)
    const res = await post(route(), 'x'.repeat(DEFAULT_MAX_BODY_BYTES))
    expect(res.status).toBe(413)
    expect((await res.json()).error.details).toEqual({ maxBytes: DEFAULT_MAX_BODY_BYTES })
  })

  it('authenticates before measuring the body', async () => {
    const res = await route()({ request: request('/x', { method: 'POST', body: 'x'.repeat(99) }) })
    expect(res.status).toBe(401)
  })
})
