// Client address of a request, for the sign-in limiter and the `ip` of the request log.
// `MAILSINK_TRUST_PROXY` (D185, off by default): behind a reverse proxy, the socket address
// is the proxy's, so every visitor would share one limiter budget and one logged address.

type ServerRequest = Request & { ip?: string; context?: { clientAddress?: string } }

/** Socket address, as the Start server (`getRequestIP`) and srvx expose it. */
function socketAddress(request: ServerRequest): string | null {
  return request.context?.clientAddress || request.ip || null
}

/**
 * Trusted proxy: the last `X-Forwarded-For` entry, the one the proxy in front of Mailsink
 * appended (proposition D182). Earlier entries come from the client and can be forged.
 * Without a usable header, the socket address.
 */
export function clientIp(request: Request, trustProxy: boolean): string | null {
  const socket = socketAddress(request as ServerRequest)
  if (!trustProxy) return socket
  const entries = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return entries.at(-1) ?? socket
}
