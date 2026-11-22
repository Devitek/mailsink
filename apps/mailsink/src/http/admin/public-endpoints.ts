import type { PublicEndpoints } from '@mailsink/core'
import type { Runtime } from '../../runtime/container'

/**
 * Where clients reach this instance, as written in credentials and `.env` snippets: the
 * public URL (D35); for SMTP, `MAILSINK_SMTP_PUBLIC_HOST` / `_PORT` when set (behind a port
 * mapping the listening port is not the reachable one), else the public URL hostname and
 * the port the listener is bound to.
 */
export function publicEndpoints(runtime: Runtime): PublicEndpoints {
  const { publicUrl, smtpPort, smtpPublicHost, smtpPublicPort } = runtime.config
  return {
    publicUrl,
    smtpHost: smtpPublicHost ?? new URL(publicUrl).hostname,
    smtpPort: smtpPublicPort ?? (runtime.smtpPort || smtpPort),
  }
}
