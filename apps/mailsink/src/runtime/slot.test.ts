import { afterEach, describe, expect, it } from 'vitest'
import { bootRuntime, stopRuntime } from './boot'
import { whenRuntimeReady } from './slot'

const silent = { info: () => {}, error: () => {} }

describe('whenRuntimeReady', () => {
  afterEach(async () => {
    await stopRuntime()
  })

  it('rejects when the Nitro plugin did not boot the runtime', async () => {
    await expect(whenRuntimeReady()).rejects.toThrow(/not booted/)
  })

  it('resolves with the booted runtime', async () => {
    const runtime = { smtpPort: 1, stop: async () => {} }
    void bootRuntime({ start: async () => runtime, log: silent, shutdownHooks: false })
    await expect(whenRuntimeReady()).resolves.toBe(runtime)
  })
})
