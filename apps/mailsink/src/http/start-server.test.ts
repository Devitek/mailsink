import { describe, expect, it } from 'vitest'
import { whenComplete } from './start-server'

describe('whenComplete', () => {
  it('resolves at once when the namespace is complete', async () => {
    const ns = { getCookie: () => 'x' }
    await expect(
      whenComplete(
        async () => ns,
        (v) => typeof v.getCookie === 'function',
      ),
    ).resolves.toBe(ns)
  })

  it('waits for a partial namespace to be filled in', async () => {
    const ns: { getCookie?: () => string } = {}
    setTimeout(() => {
      ns.getCookie = () => 'x'
    }, 30)
    const ready = await whenComplete(
      async () => ns,
      (v) => typeof v.getCookie === 'function',
      { stepMs: 5 },
    )
    expect(ready.getCookie?.()).toBe('x')
  })

  it('gives up after the timeout', async () => {
    await expect(
      whenComplete(
        async () => ({}),
        () => false,
        { stepMs: 5, timeoutMs: 20 },
      ),
    ).rejects.toThrow('incomplete')
  })
})
