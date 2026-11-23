import { describe, expect, it } from 'vitest'
import { clientIp } from './client-ip'

const req = (headers: Record<string, string> = {}, ip?: string) =>
  Object.assign(new Request('http://localhost/login', { headers }), ip ? { ip } : {})

describe('clientIp', () => {
  it('reads the socket address and ignores X-Forwarded-For by default', () => {
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.9' }, '10.0.0.2'), false)).toBe('10.0.0.2')
    expect(clientIp(req(), false)).toBeNull()
  })

  it('prefers the request context client address of the Start server', () => {
    const r = Object.assign(req({}, '10.0.0.2'), { context: { clientAddress: '10.0.0.3' } })
    expect(clientIp(r, false)).toBe('10.0.0.3')
  })

  it('takes the entry appended by the trusted proxy (the last one) when trusted', () => {
    const forwarded = { 'x-forwarded-for': '198.51.100.7, 203.0.113.9' }
    expect(clientIp(req(forwarded, '10.0.0.2'), true)).toBe('203.0.113.9')
    expect(clientIp(req({ 'x-forwarded-for': ' 203.0.113.9 ' }), true)).toBe('203.0.113.9')
  })

  it('falls back to the socket address without a usable header', () => {
    expect(clientIp(req({}, '10.0.0.2'), true)).toBe('10.0.0.2')
    expect(clientIp(req({ 'x-forwarded-for': ' , ' }, '10.0.0.2'), true)).toBe('10.0.0.2')
  })
})
