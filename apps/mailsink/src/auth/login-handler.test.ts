import { describe, expect, it } from 'vitest'
import { readRuntimeConfig } from '../runtime/config'
import { handleLogin } from './login-handler'
import { createLoginLimiter } from './login-limiter'
import { SESSION_COOKIE, sessionStatus } from './session'

const ADMIN_KEY = 'msk_admin_test_key'
const NOW = 1_800_000_000_000

function setup(env: Record<string, string> = {}) {
  const config = readRuntimeConfig({
    MAILSINK_ADMIN_KEY: ADMIN_KEY,
    MAILSINK_UI_LOGIN_MAX_ATTEMPTS: '3',
    MAILSINK_UI_LOGIN_LOCK_SECONDS: '42',
    ...env,
  })
  const limiter = createLoginLimiter({ maxAttempts: 3, lockSeconds: 42, now: () => NOW })
  const login = (body: unknown, client = '10.0.0.1') =>
    handleLogin(
      new Request('http://localhost/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
      { config, limiter, client, now: NOW },
    )
  return { config, login }
}

const cookieValue = (response: Response) =>
  response.headers.get('set-cookie')?.match(new RegExp(`^${SESSION_COOKIE}=([^;]+)`))?.[1]

describe('POST /login', () => {
  it('exchanges the admin key for a signed http-only session cookie', async () => {
    const { config, login } = setup()
    const response = await login({ key: ADMIN_KEY })
    expect(response.status).toBe(204)
    const header = response.headers.get('set-cookie') ?? ''
    expect(header).toMatch(/HttpOnly/)
    expect(header).toMatch(/SameSite=Lax/)
    expect(header).not.toMatch(/Secure/)
    expect(header).not.toContain(ADMIN_KEY)
    expect(sessionStatus(config, cookieValue(response), NOW)).toBe('signed-in')
    expect(sessionStatus(config, cookieValue(response), NOW + 8 * 86_400_000)).toBe('expired')
  })

  it('marks the cookie Secure behind an https public URL', async () => {
    const { login } = setup({ MAILSINK_PUBLIC_URL: 'https://mailsink.example.test' })
    expect((await login({ key: ADMIN_KEY })).headers.get('set-cookie')).toMatch(/Secure/)
  })

  it('refuses a wrong key without telling how many attempts remain', async () => {
    const { login } = setup()
    const response = await login({ key: 'msk_admin_wrong' })
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()
    const body = await response.json()
    expect(body).toEqual({ error: { code: 'unauthorized', message: 'Invalid admin key' } })
  })

  it('answers 429 with Retry-After from the failure reaching the threshold', async () => {
    const { login } = setup()
    expect((await login({ key: 'a' })).status).toBe(401)
    expect((await login({ key: 'b' })).status).toBe(401)
    const third = await login({ key: 'c' })
    expect(third.status).toBe(429)
    expect(third.headers.get('retry-after')).toBe('42')
    // Even the right key waits: the key is not checked during the pause.
    const right = await login({ key: ADMIN_KEY })
    expect(right.status).toBe(429)
    expect(right.headers.get('set-cookie')).toBeNull()
    // Another client is not affected.
    expect((await login({ key: ADMIN_KEY }, '10.0.0.2')).status).toBe(204)
  })

  it('validates the body', async () => {
    const { login } = setup()
    for (const body of ['not json', {}, { key: '' }, { key: 'x'.repeat(5000) }]) {
      expect((await login(body)).status).toBe(422)
    }
  })

  it('refuses every key when no admin key is configured', async () => {
    const config = readRuntimeConfig({})
    const limiter = createLoginLimiter({ maxAttempts: 5, lockSeconds: 60 })
    const request = new Request('http://localhost/login', {
      method: 'POST',
      body: JSON.stringify({ key: 'anything' }),
    })
    expect((await handleLogin(request, { config, limiter, client: 'x' })).status).toBe(401)
  })

  it('is disabled with MAILSINK_UI_AUTH=none, where every visitor is signed in', async () => {
    const { config, login } = setup({ MAILSINK_UI_AUTH: 'none' })
    expect((await login({ key: ADMIN_KEY })).status).toBe(404)
    expect(sessionStatus(config, undefined)).toBe('signed-in')
  })

  it('tells a missing cookie from an expired or forged one', () => {
    const { config } = setup()
    expect(sessionStatus(config, undefined)).toBe('signed-out')
    expect(sessionStatus(config, 'v1.1.x.forged')).toBe('expired')
  })
})
