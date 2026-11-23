import { insertCapturedMessage } from '@mailsink/core/capture-testing'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { SESSION_COOKIE, sessionSecret } from '../../auth/session'
import { issueSessionToken } from '../../auth/session-token'
import { installTestRuntime } from '../../http/test-fixtures'
import { stopRuntime } from '../../runtime/boot'
import type { Runtime } from '../../runtime/container'
import { streamForSession } from '../realtime/stream-route.server'
import { attachmentForSession, htmlForSession, rawForSession } from './download-routes.server'

// The request cookie jar of TanStack Start, replaced by a plain map.
const jar = vi.hoisted(() => new Map<string, string>())
vi.mock('@tanstack/react-start/server', () => ({
  getCookie: (name: string) => jar.get(name),
  setCookie: () => undefined,
  deleteCookie: () => undefined,
  getRequest: () => new Request('http://localhost/'),
  getRequestHeader: () => undefined,
  getRequestIP: () => '127.0.0.1',
}))

describeDb('inbox session routes', (ctx) => {
  let runtime: Runtime
  let slug: string
  let message: { id: string; attachmentIds: string[] }

  beforeAll(async () => {
    runtime = await installTestRuntime(ctx.handle)
    const ws = await createTestWorkspace(ctx.db)
    slug = ws.slug
    message = await insertCapturedMessage(ctx.db, ws.id, {
      html: '<html><head></head><body><img src="cid:logo@x"><script>x()</script></body></html>',
      raw: 'Subject: Hi\r\n\r\nHello',
      attachments: [
        { filename: 'logo.png', contentType: 'image/png', content: 'PNG', contentId: 'logo@x' },
        { filename: 'page.html', contentType: 'text/html', content: '<script>1</script>' },
      ],
    })
  })
  afterAll(() => stopRuntime())
  beforeEach(() => {
    jar.clear()
    const secret = sessionSecret(runtime.config) as string
    jar.set(SESSION_COOKIE, issueSessionToken(secret, { ttlSeconds: 600, now: Date.now() }))
  })

  it('refuses without a session or for an unknown workspace', async () => {
    jar.clear()
    expect((await rawForSession(slug, message.id)).status).toBe(401)
    const stream = await streamForSession(new Request('http://x/stream'), slug)
    expect(stream.status).toBe(401)
    jar.set(SESSION_COOKIE, 'v1.forged')
    expect((await rawForSession(slug, message.id)).status).toBe(401)
  })

  it('answers 404 for another workspace, a missing message or no HTML', async () => {
    expect((await rawForSession('no-such-workspace', message.id)).status).toBe(404)
    expect((await rawForSession(slug, 'msg_missing')).status).toBe(404)
    const other = await createTestWorkspace(ctx.db)
    expect((await rawForSession(other.slug, message.id)).status).toBe(404)
    const textOnly = await insertCapturedMessage(ctx.db, other.id, { html: null })
    expect((await htmlForSession(other.slug, textOnly.id, 'light')).status).toBe(404)
  })

  it('serves the preview with the sandbox CSP and inline images', async () => {
    const res = await htmlForSession(slug, message.id, 'dark')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-security-policy')).toMatch(/^sandbox; default-src 'none'/)
    expect(res.headers.get('content-security-policy')).not.toContain('script-src')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    const body = await res.text()
    expect(body).toContain('<head><meta name="color-scheme" content="dark"><base target="_blank">')
    expect(body).toContain(`src="data:image/png;base64,${Buffer.from('PNG').toString('base64')}"`)
  })

  it('forbids remote resources when remote images are blocked', async () => {
    const res = await htmlForSession(slug, message.id, 'light', { blockRemote: true })
    const csp = res.headers.get('content-security-policy') ?? ''
    expect(csp).toContain('img-src data:')
    expect(csp).not.toMatch(/https?:/)
    expect(await res.text()).toContain('data:image/png;base64,')
  })

  it('downloads the raw EML and attachments with the Capture download headers', async () => {
    const raw = await rawForSession(slug, message.id)
    expect(raw.headers.get('content-type')).toBe('message/rfc822')
    expect(raw.headers.get('content-disposition')).toContain(`${message.id}.eml`)
    expect(await raw.text()).toBe('Subject: Hi\r\n\r\nHello')

    const page = await attachmentForSession(slug, message.id, message.attachmentIds[1] as string)
    expect(page.headers.get('content-disposition')).toMatch(/^attachment; filename="page.html"/)
    expect(page.headers.get('content-security-policy')).toBe("sandbox; default-src 'none'")
  })

  it('streams the workspace events, replaying after ?lastEventId=', async () => {
    const abort = new AbortController()
    const res = await streamForSession(
      new Request('http://x/stream?lastEventId=evt_unknown', { signal: abort.signal }),
      slug,
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/event-stream; charset=utf-8')
    const reader = (res.body as ReadableStream<Uint8Array>).getReader()
    const first = new TextDecoder().decode((await reader.read()).value)
    expect(first).toContain('retry: 3000')
    abort.abort()
    await reader.cancel()
  })
})
