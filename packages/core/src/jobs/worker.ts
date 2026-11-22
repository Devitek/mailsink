export type WorkerOptions = {
  intervalMs: number
  /** One polling round. The real queue (D5) claims jobs here; the spike only counts ticks. */
  tick: () => Promise<void>
  onError?: (error: unknown) => void
}

export type Worker = {
  readonly running: boolean
  /** Stops polling and resolves once the tick in flight (if any) has settled. */
  stop: () => Promise<void>
}

/** In-process polling loop: one tick at a time, never overlapping. */
export function startWorker(options: WorkerOptions): Worker {
  let running = true
  let inFlight: Promise<void> | undefined

  const timer = setInterval(() => {
    if (!running || inFlight) return
    inFlight = options
      .tick()
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
      await inFlight
    },
  }
}
