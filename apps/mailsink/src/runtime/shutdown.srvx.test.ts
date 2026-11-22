import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { srvxDrainMs, srvxDrainsHttp } from './shutdown'

/**
 * Contract test for the srvx behaviour mirrored by shutdown.ts (#60). It runs the srvx
 * that Nitro itself depends on (resolved through nitro's package), so a srvx or Nitro
 * upgrade that changes when the graceful shutdown is installed, or how its timeout is
 * read, breaks this test instead of silently desynchronising the shutdown sequence.
 */
type SrvxServe = (options: Record<string, unknown>) => { close: () => Promise<void> }

async function loadSrvxServe(): Promise<SrvxServe> {
  const fromApp = createRequire(import.meta.url)
  const fromNitro = createRequire(fromApp.resolve('nitro/package.json'))
  const mod = await import(pathToFileURL(fromNitro.resolve('srvx/node')).href)
  return mod.serve as SrvxServe
}

const SIGNALS = ['SIGTERM', 'SIGINT'] as const

/** Creates a srvx server (not listening) and returns the signal handlers it installed. */
async function srvxSignalHandlers(env: Record<string, string | undefined>, silent = true) {
  const serve = await loadSrvxServe()
  for (const name of ['CI', 'TEST', 'SERVER_SHUTDOWN_TIMEOUT']) vi.stubEnv(name, env[name] ?? '')
  const before = process.listeners('SIGTERM')
  const server = serve({ fetch: () => new Response('ok'), manual: true, silent })
  const added = process.listeners('SIGTERM').filter((l) => !before.includes(l))
  for (const signal of SIGNALS) for (const l of added) process.off(signal, l)
  return { server, handler: added[0] as (() => Promise<void>) | undefined }
}

/** Seconds srvx announces when its shutdown starts with a close that never resolves. */
async function srvxAnnouncedSeconds(env: Record<string, string | undefined>): Promise<number> {
  // srvx binds process.stderr.write when the server is created: spy on it before.
  const writes: string[] = []
  const write = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    writes.push(String(chunk))
    return true
  })
  try {
    const { server, handler } = await srvxSignalHandlers(env, false)
    if (!handler) throw new Error('srvx installed no signal handler')
    server.close = () => new Promise<void>(() => {})
    vi.useFakeTimers()
    // The first countdown line is written synchronously, before the first await.
    void handler()
    const match = writes.join('').match(/gracefully \((\d+)s\)/)
    if (!match) throw new Error(`unexpected srvx output: ${JSON.stringify(writes)}`)
    return Number(match[1])
  } finally {
    // Dropping the fake timers leaves the pending countdown (and its forced close) unrun.
    vi.useRealTimers()
    write.mockRestore()
  }
}

describe('srvx graceful shutdown (contract mirrored by shutdown.ts)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([{}, { CI: 'true' }, { TEST: '1' }, { CI: 'true', TEST: 'true' }])(
    'srvxDrainsHttp matches whether srvx traps the signals (%o)',
    async (env) => {
      const { handler } = await srvxSignalHandlers(env)
      expect(handler !== undefined).toBe(srvxDrainsHttp(env))
    },
  )

  it.each([
    {},
    { SERVER_SHUTDOWN_TIMEOUT: '2' },
    { SERVER_SHUTDOWN_TIMEOUT: '0' },
    { SERVER_SHUTDOWN_TIMEOUT: 'x' },
  ])('srvxDrainMs matches the drain timeout srvx applies (%o)', async (env) => {
    expect((await srvxAnnouncedSeconds(env)) * 1000).toBe(srvxDrainMs(env))
  })
})
