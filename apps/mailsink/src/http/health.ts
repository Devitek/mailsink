export type Health = {
  status: 'ok'
  uptimeSeconds: number
}

/** Liveness payload of GET /healthz. Readiness checks (DB, SMTP) are added with them. */
export function health(uptimeSeconds: number = process.uptime()): Health {
  return { status: 'ok', uptimeSeconds: Math.floor(uptimeSeconds) }
}
