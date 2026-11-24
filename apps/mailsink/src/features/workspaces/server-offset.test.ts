import { describe, expect, it } from 'vitest'
import { measureServerOffset } from './server-offset'

const answer = (date: string | null) => async () =>
  new Response('{}', { headers: date ? { date } : {} })

describe('measureServerOffset', () => {
  it('reads how far ahead the server clock is from the Date header of /healthz', async () => {
    const ahead = new Date(Date.now() + 120_000).toUTCString()
    const offset = await measureServerOffset(answer(ahead))
    expect(offset).toBeGreaterThan(118_000)
    expect(offset).toBeLessThan(121_000)
  })

  it('keeps the browser clock when the header agrees, is missing or the probe fails', async () => {
    expect(await measureServerOffset(answer(new Date().toUTCString()))).toBe(0)
    expect(await measureServerOffset(answer(null))).toBe(0)
    const failing = async (): Promise<Response> => {
      throw new TypeError('offline')
    }
    expect(await measureServerOffset(failing)).toBe(0)
  })
})
