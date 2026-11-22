import { afterEach, describe, expect, it, vi } from 'vitest'
import { startWorker } from './worker'

describe('startWorker', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ticks on every interval until stopped', async () => {
    vi.useFakeTimers()
    const tick = vi.fn(async () => {})
    const worker = startWorker({ intervalMs: 100, tick })

    await vi.advanceTimersByTimeAsync(350)
    expect(tick).toHaveBeenCalledTimes(3)

    await worker.stop()
    await vi.advanceTimersByTimeAsync(500)
    expect(tick).toHaveBeenCalledTimes(3)
    expect(worker.running).toBe(false)
  })

  it('never overlaps ticks and stop waits for the tick in flight', async () => {
    vi.useFakeTimers()
    let release: () => void = () => {}
    const tick = vi.fn(() => new Promise<void>((resolve) => (release = resolve)))
    const worker = startWorker({ intervalMs: 10, tick })

    await vi.advanceTimersByTimeAsync(100)
    expect(tick).toHaveBeenCalledTimes(1)

    let stopped = false
    const stopping = worker.stop().then(() => (stopped = true))
    await vi.advanceTimersByTimeAsync(0)
    expect(stopped).toBe(false)

    release()
    await stopping
    expect(stopped).toBe(true)
  })

  it('aborts the signal of the tick in flight on stop', async () => {
    vi.useFakeTimers()
    let seen: AbortSignal | undefined
    const tick = vi.fn(
      (signal: AbortSignal) =>
        new Promise<void>((resolve) => {
          seen = signal
          signal.addEventListener('abort', () => resolve())
        }),
    )
    const worker = startWorker({ intervalMs: 10, tick })
    await vi.advanceTimersByTimeAsync(10)
    expect(seen?.aborted).toBe(false)
    await worker.stop()
    expect(seen?.aborted).toBe(true)
  })

  it('reports tick errors and keeps running', async () => {
    vi.useFakeTimers()
    const onError = vi.fn()
    const tick = vi.fn(async () => {
      throw new Error('boom')
    })
    const worker = startWorker({ intervalMs: 10, tick, onError })

    await vi.advanceTimersByTimeAsync(25)
    expect(onError).toHaveBeenCalledTimes(2)
    await worker.stop()
  })
})
