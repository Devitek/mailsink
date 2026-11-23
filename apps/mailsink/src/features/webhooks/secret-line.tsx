import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '@mailsink/ui'
import { useState } from 'react'
import type { EndpointRow } from '../../server-fns/webhooks-types'
import { CopyButton } from '../connections/copy-button'
import { ConfirmDialog } from '../workspaces/confirm-dialog'
import { useEndpointMutations } from './queries'

type SecretLineProps = {
  slug: string
  endpoint: EndpointRow
  /** Clear secret issued on this page: shown without asking. */
  fresh?: string
  onRotated: (secret: string | null) => void
}

// Signing secret of a unified or Resend endpoint (D136, D202): the preview, « Reveal »
// reads the stored secret on demand, « Rotate » issues a new one (the old one stops
// verifying at once) and shows it.
export function SecretLine({ slug, endpoint, fresh, onRotated }: SecretLineProps) {
  const { t } = useLingui()
  const { update, reveal } = useEndpointMutations(slug)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const shown = revealed ?? fresh ?? null
  const preview = `${(endpoint.secretPreview ?? 'whsec_').replace('…', '')}••••••••••••`

  async function toggle() {
    if (revealed) return setRevealed(null)
    setFailed(false)
    try {
      setRevealed((await reveal(endpoint.id)).secret)
    } catch {
      setFailed(true)
    }
  }

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-[13px]">
      <span>
        <Trans>Signing secret</Trans>
      </span>
      <span data-testid="webhook-secret" className="break-all font-mono text-ms-text-muted">
        {shown ?? preview}
      </span>
      {!fresh && (
        <Button variant="link" size="sm" onClick={toggle}>
          {revealed ? <Trans>Hide</Trans> : <Trans>Reveal</Trans>}
        </Button>
      )}
      {shown && <CopyButton value={shown} label={t`Copy the signing secret`} size="sm" />}
      <ConfirmDialog
        trigger={<Button variant="link" size="sm" />}
        triggerLabel={<Trans>Rotate</Trans>}
        title={<Trans>Rotate the signing secret?</Trans>}
        description={
          <Trans>
            A new secret is generated and shown. Deliveries signed with the current one stop
            verifying at once: update the receiver.
          </Trans>
        }
        confirmLabel={<Trans>Rotate</Trans>}
        onConfirm={async () => {
          const saved = await update.mutateAsync({
            id: endpoint.id,
            patch: { rotateSecret: true },
          })
          setRevealed(null)
          if (saved.ok) onRotated(saved.endpoint.secret)
        }}
      />
      {failed && (
        <span role="alert" className="text-ms-danger">
          <Trans>The secret could not be read.</Trans>
        </span>
      )}
    </span>
  )
}
