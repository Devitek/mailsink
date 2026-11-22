import { afterEach, describe, expect, it } from 'vitest'
import { bootRuntime, stopRuntime } from './boot'
import type { Runtime } from './container'
import { whenRuntimeReady, whenRuntimeStopped } from './slot'

const silent = { info: () => {}, warn: () => {}, error: () => {} }

describe('whenRuntimeReady', () => {
  afterEach(async () => {
    await stopRuntime()
  })

  it('rejects when the Nitro plugin did not boot the runtime', async () => {
    await expect(whenRuntimeReady()).rejects.toThrow(/not booted/)
  })

  it('resolves with the booted runtime', async () => {
    const runtime = { smtpPort: 1, stop: async () => {} } as unknown as Runtime
    void bootRuntime({ start: async () => runtime, log: silent, shutdownHooks: false })
    await expect(whenRuntimeReady()).resolves.toBe(runtime)
  })

  it('notifies stop waiters once the runtime stopped, whoever stopped it', async () => {
    const runtime = { smtpPort: 1, stop: async () => {} } as unknown as Runtime
    await bootRuntime({ start: async () => runtime, log: silent, shutdownHooks: false })
    let stopped = false
    const waiting = whenRuntimeStopped().then(() => {
      stopped = true
    })
    expect(stopped).toBe(false)
    await stopRuntime()
    await waiting
    expect(stopped).toBe(true)
  })
})
