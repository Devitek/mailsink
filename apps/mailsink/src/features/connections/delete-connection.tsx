import { Trans } from '@lingui/react/macro'
import { Button } from '@mailsink/ui'
import { ConfirmDialog } from '../workspaces/confirm-dialog'

// « Delete the connection » at the bottom of its panel: a hard delete (D173), confirmed.
export function DeleteConnection({
  name,
  onConfirm,
}: Readonly<{ name: string; onConfirm: () => Promise<void> }>) {
  return (
    <ConfirmDialog
      danger
      trigger={<Button variant="danger" />}
      triggerLabel={<Trans>Delete the connection</Trans>}
      title={<Trans>Delete the connection {name}?</Trans>}
      description={
        <Trans>
          Its credentials stop working and its webhook endpoints are deleted. Captured messages stay
          in the workspace.
        </Trans>
      }
      confirmLabel={<Trans>Delete</Trans>}
      onConfirm={onConfirm}
    />
  )
}
