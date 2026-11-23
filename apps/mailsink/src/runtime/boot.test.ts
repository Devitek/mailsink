import { once } from 'node:events'
import { mkdtempSync } from 'node:fs'
import { type AddressInfo, createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { workspaces } from '@mailsink/db'
import { createTransport } from 'nodemailer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bootRuntime, stopRuntime } from './boot'
import { createRuntime, type Runtime } from './container'

const silent = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
const base = {
  databaseUrl: 'pglite://memory',
  adminKey: 'admin',
  smtpHost: '127.0.0.1',
  smtpPort: 0,
  workerIntervalMs: 10,
  maxMessageBytes: 26_214_400,
  publicUrl: 'http://localhost:3000',
  defaultIdleTtlSeconds: 3600,
}
// A real boot migrates a PGlite database: 3 to 5 s alone, far more under a loaded full
// suite, hence the generous limit (#94).
const BOOT_TIMEOUT_MS = 60_000
const fake = (smtpPort = 1) => ({ smtpPort, stop: vi.fn(async () => {}) }) as unknown as Runtime

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

  it(
    'boots a migrated database and a real SMTP listener, then stops cleanly',
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'mailsink-boot-'))
      const config = { ...base, databaseUrl: `pglite://${dir}` }
      const runtime = await bootRuntime({
        start: () => createRuntime(config, silent),
        log: silent,
        shutdownHooks: false,
      })
      // Fresh data dir: the boot applied the migrations.
      expect(await runtime.db.db.select().from(workspaces)).toEqual([])

      const transport = createTransport({
        host: '127.0.0.1',
        port: runtime.smtpPort,
        ignoreTLS: true,
      })
      // The SMTP server answers (ingestion itself is covered by container.test.ts).
      await expect(transport.verify()).resolves.toBe(true)
      transport.close()

      await stopRuntime()
      const after = createTransport({ host: '127.0.0.1', port: runtime.smtpPort, ignoreTLS: true })
      await expect(after.verify()).rejects.toThrow()
      after.close()
      await expect(runtime.db.db.select().from(workspaces)).rejects.toThrow()
    },
    BOOT_TIMEOUT_MS,
  )

  it(
    'fails to start when the SMTP port is taken, closing the database again',
    async () => {
      const blocker = createServer().listen(0, '127.0.0.1')
      await once(blocker, 'listening')
      const { port } = blocker.address() as AddressInfo
      const close = vi.spyOn(PGlite.prototype, 'close')
      try {
        const config = { ...base, databaseUrl: 'pglite://memory', smtpPort: port }
        await expect(createRuntime(config, silent)).rejects.toThrow(/EADDRINUSE/)
        expect(close).toHaveBeenCalled()
      } finally {
        close.mockRestore()
        blocker.close()
      }
    },
    BOOT_TIMEOUT_MS,
  )
})
