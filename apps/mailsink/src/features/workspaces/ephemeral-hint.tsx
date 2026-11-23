import { Trans } from '@lingui/react/macro'
import { useInstance } from '../shell/instance'

/** The Admin API call creating the ephemeral equivalent (03-contracts, #19). */
export function ephemeralCurl(publicUrl: string): string {
  return [
    `curl -X POST ${publicUrl}/admin/workspaces \\`,
    '  -H "Authorization: Bearer $MAILSINK_ADMIN_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    `  -d '{"name":"ci-$RUN_ID-$WORKER","ephemeral":true,"idleTtlSeconds":3600}'`,
  ].join('\n')
}

// Bottom of the creation dialog: the ephemeral equivalent for CI / E2E, which the UI does
// not create (hidden by default, deleted after an idle hour).
export function EphemeralHint() {
  const { publicUrl } = useInstance()
  return (
    <div>
      <p className="mb-2 text-xs text-ms-text-faint">
        <Trans>
          Ephemeral equivalent (CI / E2E), hidden by default, deleted after one idle hour:
        </Trans>
      </p>
      <pre className="m-0 rounded-md border border-ms-border bg-ms-bg px-4 py-3.5 font-mono text-[11.5px] leading-[1.6] break-all whitespace-pre-wrap text-ms-text-muted">
        {ephemeralCurl(publicUrl)}
      </pre>
    </div>
  )
}
