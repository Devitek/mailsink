import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { installShutdownHooks, srvxDrainMs, srvxDrainsHttp } from './shutdown'

const silent = { info: () => {}, warn: () => {}, error: () => {} }

function setup(options: {
  stop?: () => Promise<void>
  stopped?: () => Promise<void>
  httpDrains?: boolean
  drainTimeoutMs?: number
  timeoutMs?: number
}) {
  const target = new EventEmitter()
  const exit = vi.fn()
  const stop = vi.fn(options.stop ?? (async () => {}))
  const stopped = vi.fn(options.stopped ?? (() => new Promise<void>(() => {})))
  installShutdownHooks({
    stop,
    stopped,
    log: silent,
    target: target as unknown as Pick<NodeJS.Process, 'on'>,
    exit,
    httpDrains: options.httpDrains ?? false,
    drainTimeoutMs: options.drainTimeoutMs ?? 1000,
    timeoutMs: options.timeoutMs ?? 2000,
  })
  return { target, exit, stop, stopped }
}

describe('installShutdownHooks', () => {
  it.each(['SIGTERM', 'SIGINT'])('stops the runtime then exits 0 on %s', async (signal) => {
    const { target, exit, stop, stopped } = setup({})
    target.emit(signal, signal)
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0))
    expect(stop).toHaveBeenCalledTimes(1)
    expect(stopped).not.toHaveBeenCalled()
  })

  it('waits for the close hook (HTTP drained by srvx) before exiting 0', async () => {
    let closeHook: () => void = () => {}
    const { target, exit, stop } = setup({
      httpDrains: true,
      stopped: () => new Promise<void>((resolve) => (closeHook = resolve)),
    })
    target.emit('SIGTERM', 'SIGTERM')
    await new Promise((r) => setTimeout(r, 30))
    expect(exit).not.toHaveBeenCalled()
    expect(stop).not.toHaveBeenCalled()

    closeHook()
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0))
    // stop() is idempotent: called once more to cover a close hook that never ran.
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('stops the runtime itself when the close hook never comes', async () => {
    const { target, exit, stop } = setup({ httpDrains: true, drainTimeoutMs: 20 })
    target.emit('SIGTERM', 'SIGTERM')
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0))
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('forces exit 1 on a second signal', () => {
    const { target, exit, stop } = setup({ stop: () => new Promise(() => {}) })
    target.emit('SIGTERM', 'SIGTERM')
    target.emit('SIGINT', 'SIGINT')
    expect(exit).toHaveBeenCalledWith(1)
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('forces exit 1 when the shutdown exceeds the timeout', async () => {
    const { target, exit } = setup({ stop: () => new Promise(() => {}), timeoutMs: 30 })
    target.emit('SIGTERM', 'SIGTERM')
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1))
  })

  it('exits 1 when the stop fails', async () => {
    const { target, exit } = setup({ stop: async () => Promise.reject(new Error('boom')) })
    target.emit('SIGTERM', 'SIGTERM')
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1))
  })
})

describe('srvx graceful shutdown mirror', () => {
  it('is off when CI or TEST is set, as in srvx', () => {
    expect(srvxDrainsHttp({})).toBe(true)
    expect(srvxDrainsHttp({ CI: 'true' })).toBe(false)
    expect(srvxDrainsHttp({ TEST: '1' })).toBe(false)
  })

  it('reads SERVER_SHUTDOWN_TIMEOUT in seconds, 5 by default', () => {
    expect(srvxDrainMs({})).toBe(5000)
    expect(srvxDrainMs({ SERVER_SHUTDOWN_TIMEOUT: '2' })).toBe(2000)
    expect(srvxDrainMs({ SERVER_SHUTDOWN_TIMEOUT: 'x' })).toBe(5000)
  })
})
