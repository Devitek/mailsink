import { describe, expect, it } from 'vitest'
import { isBlockedAddress, privateAddressGuard } from './url-guard'

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:a9fe:a9fe',
  ])('blocks %s', (address) => {
    expect(isBlockedAddress(address)).toBe(true)
  })

  it.each(['93.184.215.14', '172.32.0.1', '8.8.8.8', '2606:4700::1111', '::ffff:8.8.8.8'])(
    'lets %s through',
    (address) => {
      expect(isBlockedAddress(address)).toBe(false)
    },
  )
})

describe('privateAddressGuard', () => {
  const lookup = (table: Record<string, string[]>) => async (host: string) => {
    const addresses = table[host]
    if (!addresses) throw Object.assign(new Error('not found'), { code: 'ENOTFOUND' })
    return addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }))
  }
  const guard = privateAddressGuard(
    lookup({
      'hooks.example': ['93.184.215.14'],
      'internal.example': ['93.184.215.14', '10.0.0.5'],
      localhost: ['127.0.0.1', '::1'],
    }),
  )

  it('refuses a host when one of its addresses is private', async () => {
    expect(await guard('https://internal.example/hook')).toMatch(/10\.0\.0\.5/)
    expect(await guard('http://localhost:4000/hook')).toMatch(/127\.0\.0\.1/)
  })

  it('checks IP literals without resolving them', async () => {
    expect(await guard('http://169.254.169.254/latest')).toMatch(/169\.254\.169\.254/)
    expect(await guard('http://[::1]:8080/')).toMatch(/::1/)
    expect(await guard('http://[::ffff:127.0.0.1]/')).not.toBeNull()
  })

  it('accepts public hosts and leaves unresolvable ones to the request itself', async () => {
    expect(await guard('https://hooks.example/x')).toBeNull()
    expect(await guard('https://nowhere.example/x')).toBeNull()
  })
})
