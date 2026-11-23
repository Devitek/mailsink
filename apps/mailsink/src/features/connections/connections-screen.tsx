import { Trans } from '@lingui/react/macro'
import type { CreatedConnection } from '@mailsink/contracts'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { ConnectionsPage } from '../../server-fns/connections-types'
import { WorkspaceSummary } from '../workspaces/workspace-summary'
import { ConnectionList } from './connection-list'
import { ConnectionPanel } from './connection-panel'
import { NewConnectionForm } from './new-connection-form'
import { Panel } from './panel'
import { WorkspaceKeyCard } from './workspace-key-card'

type ConnectionsScreenProps = {
  page: ConnectionsPage
  /** `?connection=`: an id, `new`, or nothing (the first connection). */
  selected: string | undefined
}

// Workspace and connection management screen (#38, prototype « Paramètres > Connexions »):
// the workspace card on top, then the connection list and the panel of the selected one.
// Secrets created or rotated here stay in memory until the page is left (shown once).
export function ConnectionsScreen({ page, selected }: ConnectionsScreenProps) {
  const navigate = useNavigate()
  const slug = page.workspace.slug
  const [fresh, setFresh] = useState<Record<string, CreatedConnection>>({})
  const { connections } = page
  const current =
    selected === 'new' ? undefined : (connections.find((c) => c.id === selected) ?? connections[0])
  const creating = selected === 'new' || connections.length === 0

  const select = (connection: string | undefined) =>
    navigate({
      to: '/w/$workspaceSlug/connections',
      params: { workspaceSlug: slug },
      search: connection ? { connection } : {},
      replace: true,
    })
  const remember = (created: CreatedConnection) =>
    setFresh((all) => ({ ...all, [created.id]: created }))

  return (
    // Rendered inside the workspace layout's <main>: this area scrolls on its own.
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-[23px] px-[27px] py-[30px] max-sm:px-4">
        <WorkspaceSummary workspace={page.workspace} />
        <WorkspaceKeyCard slug={slug} keyPreview={page.workspace.keyPreview ?? null} />
        <div className="flex flex-wrap items-start gap-[23px]">
          <ConnectionList
            slug={slug}
            connections={connections}
            selected={creating ? 'new' : current?.id}
          />
          <Panel>
            {creating ? (
              <NewConnectionForm
                slug={slug}
                onCreated={(created) => {
                  remember(created)
                  void select(created.id)
                }}
                onCancel={() => void select(undefined)}
              />
            ) : current ? (
              <ConnectionPanel
                key={current.id}
                slug={slug}
                connection={current}
                fresh={fresh[current.id]}
                onRotated={remember}
                onDeleted={() => void select(undefined)}
              />
            ) : (
              <p className="p-[22px] text-sm text-ms-text-muted">
                <Trans>Select a connection.</Trans>
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
