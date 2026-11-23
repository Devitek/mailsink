import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '@mailsink/ui'
import type { EndpointRow } from '../../server-fns/webhooks-types'
import { useEndpointMutations } from './queries'

// « Test d'envoi » (B1-2, D140): one signed sample `email.delivered` in the endpoint's
// format, sent at once without retry; the answer (code and duration, or the error) shows
// next to the button. A disabled endpoint must be enabled first, as in the prototype.
export function TestSend({ slug, endpoint }: Readonly<{ slug: string; endpoint: EndpointRow }>) {
  const { t } = useLingui()
  const { test } = useEndpointMutations(slug)
  const result = test.data
  const failed = result && result.status !== 'succeeded'
  return (
    <span className="flex items-center gap-2.5">
      <span aria-live="polite" data-testid="test-send-result" className="font-mono text-xs">
        {test.isError ? (
          <span className="text-ms-danger">
            <Trans>Test failed</Trans>
          </span>
        ) : result ? (
          <span className={failed ? 'text-ms-danger' : 'text-ms-status-delivered'}>
            {result.event} → {result.statusCode ?? result.error ?? result.status}
            {result.durationMs !== null && ` · ${result.durationMs} ms`}
          </span>
        ) : null}
      </span>
      <Button
        size="sm"
        disabled={!endpoint.enabled || test.isPending}
        title={endpoint.enabled ? undefined : t`Enable the endpoint to test it`}
        onClick={() => test.mutate(endpoint.id)}
      >
        <Trans>Test send</Trans>
      </Button>
    </span>
  )
}
