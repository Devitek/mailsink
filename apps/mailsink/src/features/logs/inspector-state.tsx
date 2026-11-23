import { Trans } from '@lingui/react/macro'
import { SheetBody, SheetTitle } from '@mailsink/ui'

// Loading and « not found » states of the inspector sheet (a row purged or expired since).
export function InspectorState({ status }: Readonly<{ status: 'pending' | 'error' | 'success' }>) {
  return (
    <SheetBody className="grid place-items-center">
      <SheetTitle className="text-body font-normal text-ms-text-faint">
        {status === 'error' ? (
          <Trans>This row no longer exists (purged or expired).</Trans>
        ) : (
          <Trans>Loading…</Trans>
        )}
      </SheetTitle>
    </SheetBody>
  )
}
