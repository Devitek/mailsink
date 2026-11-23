import { Trans } from '@lingui/react/macro'
import { Dialog, DialogContent, DialogTrigger } from '@mailsink/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { CreatedWorkspace } from '../../server-fns/connections-types'
import { NewWorkspaceForm } from './new-workspace-form'
import { WorkspaceCreated } from './workspace-created'

// « + Nouveau workspace » of the picker (#38): the prototype modal « Nouveau workspace
// persistant », then, once created, its secrets (workspace key, first connection) shown
// once before opening the workspace.
export function NewWorkspaceDialog({ onDone }: Readonly<{ onDone?: () => void }>) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [created, setCreated] = useState<CreatedWorkspace | null>(null)

  function change(next: boolean) {
    setOpen(next)
    if (!next) setCreated(null)
  }

  async function onCreated(workspace: CreatedWorkspace) {
    setCreated(workspace)
    await queryClient.invalidateQueries({ queryKey: ['workspaces'] })
  }

  async function openWorkspace(workspace: CreatedWorkspace) {
    change(false)
    onDone?.()
    const workspaceSlug = workspace.slug
    if (workspace.connections.length > 0) {
      await navigate({ to: '/w/$workspaceSlug/connections', params: { workspaceSlug } })
    } else {
      await navigate({ to: '/w/$workspaceSlug', params: { workspaceSlug } })
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger className="flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-[11px] py-[11px] text-left text-ms-text-muted outline-none hover:bg-ms-hover hover:text-ms-text focus-visible:focus-ring">
        <span aria-hidden className="w-3.5 text-center">
          +
        </span>
        <Trans>New workspace</Trans>
      </DialogTrigger>
      <DialogContent>
        {created ? (
          <WorkspaceCreated workspace={created} onContinue={() => openWorkspace(created)} />
        ) : (
          <NewWorkspaceForm onCreated={onCreated} />
        )}
      </DialogContent>
    </Dialog>
  )
}
