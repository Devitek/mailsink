import { Trans } from '@lingui/react/macro'
import { Button, Dialog, DialogContent, DialogTrigger } from '@mailsink/ui'
import { useState } from 'react'
import type { WorkspaceSettings } from '../../server-fns/connections-types'
import { EditWorkspaceForm } from './edit-workspace-form'

// « Edit » of the workspace card (#38). The form mounts with the dialog, so every opening
// starts from the current settings.
export function EditWorkspaceDialog({ workspace }: Readonly<{ workspace: WorkspaceSettings }>) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Trans>Edit</Trans>
      </DialogTrigger>
      <DialogContent>
        <EditWorkspaceForm workspace={workspace} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
