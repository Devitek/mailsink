import { afterEach, describe, expect, it, vi } from 'vitest'
import { bootRuntime, stopRuntime } from './boot'
import type { Runtime } from './container'
import {
  requestRestart,
  restartRuntime,
  startRuntimeFromPlugin,
  whenRestartSettled,
} from './restart'
import { runtimeSlot, whenRuntimeReady, withRuntime } from './slot'

const silent = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
const quiet = { log: silent, shutdownHooks: false }
const fake = (smtpPort = 1) => ({ smtpPort, stop: vi.fn(async () => {}) }) as unknown as Runtime

describe('runtime restart (vite dev HMR, #60)', () => {
  afterEach(async () => {
    await whenRestartSettled()
    await stopRuntime()
    runtimeSlot().started = undefined
  })

  it('boots on the first plugin evaluation and restarts on the next ones', async () => {
    const first = fake(1)
    const boot = startRuntimeFromPlugin({ ...quiet, start: async () => first }, 0)
    expect(boot.restart).toBe(false)
    await expect(boot.ready).resolves.toBe(first)

    const second = fake(2)
    const again = startRuntimeFromPlugin({ ...quiet, start: async () => second }, 0)
    expect(again.restart).toBe('scheduled')
    await expect(again.ready).resolves.toBe(second)
    expect(first.stop).toHaveBeenCalledTimes(1)
    await expect(whenRuntimeReady()).resolves.toBe(second)
  })

  it('reports the evaluations an existing pending restart absorbs as coalesced', async () => {
    await startRuntimeFromPlugin({ ...quiet, start: async () => fake(1) }, 0).ready
    const first = startRuntimeFromPlugin({ ...quiet, start: async () => fake(2) }, 20)
    const second = startRuntimeFromPlugin({ ...quiet, start: async () => fake(3) }, 20)
    expect([first.restart, second.restart]).toEqual(['scheduled', 'coalesced'])
    expect(second.ready).toBe(first.ready)
    await expect(first.ready).resolves.toMatchObject({ smtpPort: 3 })
    expect(startRuntimeFromPlugin({ ...quiet, start: async () => fake(4) }, 0).restart).toBe(
      'scheduled',
    )
  })

  it('stops the old runtime before booting the new one (same SMTP port)', async () => {
    const order: string[] = []
    const old = fake(1)
    vi.mocked(old.stop).mockImplementation(async () => {
      order.push('stop old')
    })
    await bootRuntime({ ...quiet, start: async () => old })
    await restartRuntime({
      ...quiet,
      start: async () => {
        order.push('start new')
        return fake(2)
      },
    })
    expect(order).toEqual(['stop old', 'start new'])
  })

  it('makes requests arriving during a restart wait for the new runtime', async () => {
    await bootRuntime({ ...quiet, start: async () => fake(1) })
    const next = fake(2)
    const restarting = restartRuntime({ ...quiet, start: async () => next })
    await expect(whenRuntimeReady()).resolves.toBe(next)
    await restarting
    expect(runtimeSlot().restarting).toBeUndefined()
  })

  it('waits for the requests in flight before stopping their runtime (#86)', async () => {
    const old = fake(1)
    await bootRuntime({ ...quiet, start: async () => old })
    let finish!: () => void
    const blocker = new Promise<void>((resolve) => {
      finish = resolve
    })
    const seen: Runtime[] = []
    const inFlight = withRuntime(async () => {
      await blocker
      seen.push(await whenRuntimeReady()) // still the runtime it started on
      expect(old.stop).not.toHaveBeenCalled()
      return 'done'
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    const next = fake(2)
    const restarting = restartRuntime({ ...quiet, start: async () => next })
    const late = withRuntime(async () => whenRuntimeReady())
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(old.stop).not.toHaveBeenCalled()
    finish()
    await expect(inFlight).resolves.toBe('done')
    await expect(restarting).resolves.toBe(next)
    await expect(late).resolves.toBe(next)
    expect(seen).toEqual([old])
    expect(old.stop).toHaveBeenCalledTimes(1)
  })

  it('makes a request arriving during the debounce window wait for the new code', async () => {
    await bootRuntime({ ...quiet, start: async () => fake(1) })
    const next = fake(2)
    void requestRestart({ ...quiet, start: async () => next }, 20)
    await expect(withRuntime(() => whenRuntimeReady())).resolves.toBe(next)
  })

  it('stops anyway once the drain timeout elapsed, with a warning', async () => {
    const old = fake(1)
    await bootRuntime({ ...quiet, start: async () => old })
    let finish!: () => void
    const stuck = withRuntime(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    await restartRuntime({ log, shutdownHooks: false, start: async () => fake(2) }, 5)
    expect(old.stop).toHaveBeenCalledTimes(1)
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('1 request(s) still running'))
    finish()
    await stuck
  })

  it('runs restarts requested during a restart after it, the last code winning', async () => {
    await bootRuntime({ ...quiet, start: async () => fake(1) })
    const a = fake(2)
    const b = fake(3)
    const first = restartRuntime({ ...quiet, start: async () => a })
    const second = restartRuntime({ ...quiet, start: async () => b })
    await expect(first).resolves.toBe(a)
    await expect(second).resolves.toBe(b)
    expect(a.stop).toHaveBeenCalledTimes(1)
    await expect(whenRuntimeReady()).resolves.toBe(b)
  })

  it('coalesces restarts requested within the debounce window, the last code winning', async () => {
    const old = fake(1)
    await bootRuntime({ ...quiet, start: async () => old })
    const a = vi.fn(async () => fake(2))
    const b = fake(3)
    const first = requestRestart({ ...quiet, start: a }, 20)
    const second = requestRestart({ ...quiet, start: async () => b }, 20)
    expect(second).toBe(first)
    // The old runtime keeps serving during the window.
    await expect(whenRuntimeReady()).resolves.toBe(old)
    await expect(first).resolves.toBe(b)
    expect(a).not.toHaveBeenCalled()
    expect(old.stop).toHaveBeenCalledTimes(1)
  })

  it('lets a final stop wait for a pending restart instead of being followed by a boot', async () => {
    await bootRuntime({ ...quiet, start: async () => fake(1) })
    const next = fake(2)
    void requestRestart({ ...quiet, start: async () => next }, 20)
    await whenRestartSettled()
    await stopRuntime()
    expect(next.stop).toHaveBeenCalledTimes(1)
    expect(runtimeSlot().booting).toBeUndefined()
  })

  it('keeps the slot usable after a failed restart', async () => {
    await bootRuntime({ ...quiet, start: async () => fake(1) })
    await expect(
      restartRuntime({ ...quiet, start: async () => Promise.reject(new Error('syntax')) }),
    ).rejects.toThrow('syntax')
    await expect(whenRuntimeReady()).rejects.toThrow(/not booted/)
    await expect(restartRuntime({ ...quiet, start: async () => fake(4) })).resolves.toMatchObject({
      smtpPort: 4,
    })
  })

  it('installs the signal handlers once per process, not once per boot', async () => {
    const before = process.listenerCount('SIGTERM')
    const slot = runtimeSlot()
    const installed = slot.shutdownHooks
    slot.shutdownHooks = undefined
    const added = () => process.listeners('SIGTERM').slice(before)
    try {
      await bootRuntime({ log: silent, start: async () => fake(1) })
      await restartRuntime({ log: silent, start: async () => fake(2) })
      expect(process.listenerCount('SIGTERM')).toBe(before + 1)
    } finally {
      for (const listener of added()) {
        process.off('SIGTERM', listener)
        process.off('SIGINT', listener)
      }
      slot.shutdownHooks = installed
    }
  })
})
