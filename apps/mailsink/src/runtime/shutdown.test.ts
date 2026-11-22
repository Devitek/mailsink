import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { installShutdownHooks } from './shutdown'

const silent = { info: () => {}, error: () => {} }

function setup(stop: () => Promise<void>) {
  const target = new EventEmitter()
  const exit = vi.fn()
  const runtime = { stop: vi.fn(stop) }
  installShutdownHooks(runtime.stop, {
    log: silent,
    target: target as unknown as Pick<NodeJS.Process, 'on'>,
    exit,
    timeoutMs: 50,
  })
  return { target, exit, runtime }
}

describe('installShutdownHooks', () => {
  it.each(['SIGTERM', 'SIGINT'])('stops the runtime then exits 0 on %s', async (signal) => {
    const { target, exit, runtime } = setup(async () => {})
    target.emit(signal, signal)
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0))
    expect(runtime.stop).toHaveBeenCalledTimes(1)
  })

  it('forces exit 1 on a second signal', () => {
    const { target, exit, runtime } = setup(() => new Promise(() => {}))
    target.emit('SIGTERM', 'SIGTERM')
    target.emit('SIGINT', 'SIGINT')
    expect(exit).toHaveBeenCalledWith(1)
    expect(runtime.stop).toHaveBeenCalledTimes(1)
  })

  it('forces exit 1 when the stop exceeds the timeout', async () => {
    const { target, exit } = setup(() => new Promise(() => {}))
    target.emit('SIGTERM', 'SIGTERM')
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1))
  })
})
