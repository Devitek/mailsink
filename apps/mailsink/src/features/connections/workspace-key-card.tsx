import { Trans, useLingui } from '@lingui/react/macro'
import type { RotatedWorkspaceKey } from '@mailsink/contracts'
import { Button } from '@mailsink/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { rotateWorkspaceKeyFn } from '../../server-fns/workspaces-manage-fns'
import { ConfirmDialog } from '../workspaces/confirm-dialog'
import { CredentialRow } from './credential-fields'
import { ShownOnceNotice } from './credentials-reveal'

// Workspace key (`mskw_`, D12) of the connections screen: its preview, and « Rotate » which
// revokes it at once and shows the new key once (Capture API and MCP of the whole workspace).
export function WorkspaceKeyCard({
  slug,
  keyPreview,
}: Readonly<{ slug: string; keyPreview: string | null }>) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const [fresh, setFresh] = useState<RotatedWorkspaceKey | null>(null)

  async function rotate() {
    const rotated = await rotateWorkspaceKeyFn({ data: { slug } })
    setFresh(rotated)
    await queryClient.invalidateQueries({ queryKey: ['connections', slug] })
  }

  const rotateButton = (
    <ConfirmDialog
      trigger={<Button />}
      triggerLabel={<Trans>Rotate</Trans>}
      title={<Trans>Rotate the workspace key?</Trans>}
      description={
        <Trans>
          The current mskw_ key stops working at once: every CI job, script or MCP client using it
          must get the new one.
        </Trans>
      }
      confirmLabel={<Trans>Rotate the key</Trans>}
      onConfirm={rotate}
    />
  )

  return (
    <section
      aria-label={t`Workspace key`}
      className="flex flex-col gap-3.5 rounded-lg border border-ms-border bg-ms-panel px-[22px] py-[19px]"
    >
      <div>
        <h2 className="font-semibold">
          <Trans>Workspace key</Trans>
        </h2>
        <p className="text-sm text-ms-text-muted">
          <Trans>
            Reads every message of the workspace through the Capture API and MCP, whatever the
            connection.
          </Trans>
        </p>
      </div>
      {fresh ? (
        <>
          <ShownOnceNotice />
          <CredentialRow
            label="MAILSINK_KEY"
            value={fresh.workspaceKey}
            copyValue={fresh.workspaceKey}
            copyLabel={t`Copy the workspace key`}
            testId="workspace-key-value"
            actions={rotateButton}
          />
        </>
      ) : (
        <CredentialRow
          label="MAILSINK_KEY"
          value={keyPreview ?? t`No active key: rotate to create one.`}
          actions={rotateButton}
        />
      )}
    </section>
  )
}
