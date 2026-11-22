export type WorkerOptions = {
  intervalMs: number
  /**
   * One polling round (a job runner, a retention pass). `signal` aborts when `stop()` is
   * called: a long round should stop at the next safe point and hand back unstarted work.
   */
  tick: (signal: AbortSignal) => Promise<void>
  onError?: (error: unknown) => void
}

export type Worker = {
  readonly running: boolean
  /** Stops polling, aborts the tick signal and resolves once the tick in flight settled. */
  stop: () => Promise<void>
}

/** In-process polling loop: one tick at a time, never overlapping. */
export function startWorker(options: WorkerOptions): Worker {
  let running = true
  let inFlight: Promise<void> | undefined
  const stopping = new AbortController()

  const timer = setInterval(() => {
    if (!running || inFlight) return
    inFlight = options
      .tick(stopping.signal)
      .catch((error: unknown) => options.onError?.(error))
      .finally(() => {
        inFlight = undefined
      })
  }, options.intervalMs)

  return {
    get running() {
      return running
    },
    async stop() {
      running = false
      clearInterval(timer)
      stopping.abort()
      await inFlight
    },
  }
}
