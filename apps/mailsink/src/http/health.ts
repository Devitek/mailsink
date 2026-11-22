import { sql } from 'drizzle-orm'
import type { Runtime } from '../runtime/container'
import { defineApi } from './handler'

export type CheckStatus = 'ok' | 'error'

export type Health = {
  status: 'ok' | 'unavailable'
  uptimeSeconds: number
  checks: { database: CheckStatus }
}

export interface HealthOptions {
  uptimeSeconds?: number
  /** A database that does not answer within this delay counts as down. */
  timeoutMs?: number
}

async function check(probe: () => Promise<unknown>, timeoutMs: number): Promise<CheckStatus> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<CheckStatus>((resolve) => {
    timer = setTimeout(() => resolve('error'), timeoutMs)
  })
  const run = probe().then(
    () => 'ok' as const,
    () => 'error' as const,
  )
  try {
    return await Promise.race([run, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** Probes the database with `select 1`. */
export function pingDatabase(runtime: Pick<Runtime, 'db'>): Promise<unknown> {
  return runtime.db.db.execute(sql`select 1`)
}

/**
 * Payload of GET /healthz: liveness (the process answers) plus readiness (the database
 * answers). HTTP 503 when a check fails, so orchestrators stop routing to the instance.
 */
export async function health(
  probeDatabase: () => Promise<unknown>,
  options: HealthOptions = {},
): Promise<{ httpStatus: number; body: Health }> {
  const database = await check(probeDatabase, options.timeoutMs ?? 2000)
  const ok = database === 'ok'
  return {
    httpStatus: ok ? 200 : 503,
    body: {
      status: ok ? 'ok' : 'unavailable',
      uptimeSeconds: Math.floor(options.uptimeSeconds ?? process.uptime()),
      checks: { database },
    },
  }
}

/** GET /healthz (public). */
export const healthz = defineApi({
  auth: 'none',
  handler: async ({ runtime }) => {
    const { httpStatus, body } = await health(() => pingDatabase(runtime))
    return Response.json(body, { status: httpStatus })
  },
})
