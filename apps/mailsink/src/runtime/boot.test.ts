import { createTransport } from 'nodemailer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bootRuntime, stopRuntime } from './boot'
import { createRuntime, type Runtime } from './container'

const silent = { info: vi.fn(), error: vi.fn() }
const fake = (smtpPort = 1): Runtime => ({ smtpPort, stop: vi.fn(async () => {}) })

describe('bootRuntime / stopRuntime', () => {
  afterEach(async () => {
    await stopRuntime()
  })

  it('starts the runtime once even when called repeatedly (HMR re-evaluation)', async () => {
    const runtime = fake()
    const start = vi.fn(async () => runtime)
    const [a, b] = await Promise.all([
      bootRuntime({ start, log: silent, shutdownHooks: false }),
      bootRuntime({ start, log: silent, shutdownHooks: false }),
    ])
    expect(await bootRuntime({ start, log: silent, shutdownHooks: false })).toBe(runtime)
    expect(a).toBe(b)
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('allows a retry after a failed start', async () => {
    const start = vi.fn().mockRejectedValueOnce(new Error('EADDRINUSE'))
    await expect(bootRuntime({ start, log: silent, shutdownHooks: false })).rejects.toThrow()
    start.mockResolvedValueOnce(fake(2))
    await expect(bootRuntime({ start, log: silent, shutdownHooks: false })).resolves.toMatchObject({
      smtpPort: 2,
    })
  })

  it('stops once when signal handler and close hook both ask, then allows a new boot', async () => {
    const runtime = fake()
    await bootRuntime({ start: async () => runtime, log: silent, shutdownHooks: false })
    await Promise.all([stopRuntime(), stopRuntime()])
    expect(runtime.stop).toHaveBeenCalledTimes(1)

    const start = vi.fn(async () => fake(3))
    await expect(bootRuntime({ start, log: silent, shutdownHooks: false })).resolves.toMatchObject({
      smtpPort: 3,
    })
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('stopRuntime is a no-op when nothing was booted', async () => {
    await expect(stopRuntime()).resolves.toBeUndefined()
  })

  it('boots a real SMTP listener that accepts mail and stops cleanly', async () => {
    const config = { smtpHost: '127.0.0.1', smtpPort: 0, workerIntervalMs: 10 }
    const runtime = await bootRuntime({
      start: () => createRuntime(config, silent),
      log: silent,
      shutdownHooks: false,
    })

    const transport = createTransport({
      host: '127.0.0.1',
      port: runtime.smtpPort,
      ignoreTLS: true,
    })
    await transport.sendMail({ from: 'a@example.test', to: 'b@example.test', text: 'hi' })
    transport.close()
    expect(silent.info).toHaveBeenCalledWith(expect.stringContaining('message from a@example.test'))

    await stopRuntime()
    const after = createTransport({ host: '127.0.0.1', port: runtime.smtpPort, ignoreTLS: true })
    await expect(after.verify()).rejects.toThrow()
    after.close()
  })
})
