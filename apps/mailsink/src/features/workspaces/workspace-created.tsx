import { Trans, useLingui } from '@lingui/react/macro'
import {
  Button,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mailsink/ui'
import type { CreatedWorkspace } from '../../server-fns/connections-types'
import { CredentialRow } from '../connections/credential-fields'
import { CredentialsReveal, ShownOnceNotice } from '../connections/credentials-reveal'
import { KIND_LABELS } from '../connections/kinds'

// Second step of the creation dialog (#38): the `mskw_` workspace key (Capture API, MCP)
// and the first connection's credentials, each shown this once.
export function WorkspaceCreated({
  workspace,
  onContinue,
}: Readonly<{ workspace: CreatedWorkspace; onContinue: () => void }>) {
  const { t } = useLingui()
  const slug = workspace.slug
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          <Trans>Workspace {slug} created</Trans>
        </DialogTitle>
        <DialogDescription>
          <Trans>Copy the secrets below now: they are shown only once.</Trans>
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <ShownOnceNotice>
          <Trans>
            The workspace key reads this workspace through the Capture API and MCP. Mailsink keeps a
            hash, not the key.
          </Trans>
        </ShownOnceNotice>
        <CredentialRow
          label={<Trans>Workspace key</Trans>}
          mono={false}
          value={workspace.workspaceKey}
          copyValue={workspace.workspaceKey}
          copyLabel={t`Copy the workspace key`}
          testId="workspace-key"
        />
        {workspace.connections.map((connection) => {
          const kind = KIND_LABELS[connection.kind]
          return (
            <section
              key={connection.id}
              className="flex flex-col gap-3 border-t border-ms-border pt-4"
            >
              <h3 className="text-sm font-semibold">
                <Trans>Connection {kind}</Trans>
              </h3>
              <CredentialsReveal connection={connection} />
            </section>
          )
        })}
      </DialogBody>
      <DialogFooter>
        <Button variant="primary" onClick={onContinue}>
          {workspace.connections.length > 0 ? (
            <Trans>Open its connections</Trans>
          ) : (
            <Trans>Open the workspace</Trans>
          )}
        </Button>
      </DialogFooter>
    </>
  )
}
