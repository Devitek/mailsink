import { Trans, useLingui } from '@lingui/react/macro'
import type { CreatedConnection } from '@mailsink/contracts'
import { Button, Switch } from '@mailsink/ui'
import { useId } from 'react'
import type { ConnectionRow } from '../../server-fns/connections-types'
import { ConfirmDialog } from '../workspaces/confirm-dialog'
import { ConnectionName } from './connection-name'
import { CredentialRow, EnvSnippet } from './credential-fields'
import { CredentialsReveal } from './credentials-reveal'
import { KIND_LABELS } from './kinds'
import { PanelHeader } from './panel'
import { useConnectionMutations } from './queries'

type ConnectionPanelProps = {
  slug: string
  connection: ConnectionRow
  /** Secrets of a creation or rotation made on this page: shown until the page is left. */
  fresh?: CreatedConnection
  onRotated: (connection: CreatedConnection) => void
  onDeleted: () => void
}

const rotateClass =
  'border-[color-mix(in_oklch,var(--ms-override)_40%,transparent)] bg-transparent text-ms-override hover:bg-[color-mix(in_oklch,var(--ms-override)_10%,transparent)]'

// Detail of one connection (#38): enable switch, name, credentials (masked once created,
// in clear right after a creation or rotation), `.env` snippet, rotation and deletion.
export function ConnectionPanel({
  slug,
  connection,
  fresh,
  onRotated,
  onDeleted,
}: ConnectionPanelProps) {
  const { t, i18n } = useLingui()
  const { update, rotate, remove } = useConnectionMutations(slug)
  const switchId = useId()
  const smtp = connection.setup.kind === 'smtp'
  const enabled = connection.disabledAt === null
  const created = i18n.date(connection.createdAt, { dateStyle: 'medium' })
  const kind = KIND_LABELS[connection.kind]
  const name = connection.name

  const rotateButton = (label: string) => (
    <ConfirmDialog
      trigger={<Button variant="outline" className={rotateClass} />}
      triggerLabel={`↻ ${label}`}
      title={smtp ? <Trans>Regenerate SMTP_PASS?</Trans> : <Trans>Rotate the API key?</Trans>}
      description={
        <Trans>
          A new secret is generated and shown once. The current one stops working at once: update
          every client using it.
        </Trans>
      }
      confirmLabel={smtp ? <Trans>Regenerate</Trans> : <Trans>Rotate</Trans>}
      onConfirm={async () => onRotated(await rotate.mutateAsync(connection.id))}
    />
  )

  return (
    <div data-testid="connection-panel">
      <PanelHeader
        title={connection.name}
        subtitle={
          <Trans>
            {kind} · created {created}
          </Trans>
        }
      >
        <label htmlFor={switchId} className="flex items-center gap-2.5 text-sm">
          <Switch
            id={switchId}
            checked={enabled}
            disabled={update.isPending}
            onCheckedChange={(on: boolean) =>
              update.mutate({ id: connection.id, patch: { enabled: on } })
            }
          />
          {enabled ? <Trans>Enabled</Trans> : <Trans>Disabled</Trans>}
        </label>
      </PanelHeader>
      <div className="flex flex-col gap-[18px] p-[22px]">
        {!enabled && (
          <p className="text-sm text-ms-text-muted">
            <Trans>Disabled: its credentials are refused (HTTP 403, SMTP 535) until enabled.</Trans>
          </p>
        )}
        <ConnectionName slug={slug} connection={connection} />
        {fresh ? (
          <>
            <CredentialsReveal connection={fresh} />
            <div className="flex justify-end">{rotateButton(smtp ? t`Regenerate` : t`Rotate`)}</div>
          </>
        ) : connection.setup.kind === 'smtp' ? (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-[13px]">
              <CredentialRow label="SMTP_HOST" value={connection.setup.smtpHost} />
              <CredentialRow label="SMTP_PORT" value={connection.setup.smtpPort} />
            </div>
            <CredentialRow
              label="SMTP_USER"
              value={connection.setup.smtpUser}
              copyValue={connection.setup.smtpUser}
              copyLabel={t`Copy SMTP_USER`}
            />
            <CredentialRow
              label="SMTP_PASS"
              value="••••••••••••••••"
              actions={rotateButton(t`Regenerate`)}
            />
          </>
        ) : (
          <>
            <CredentialRow
              label={<Trans>API key</Trans>}
              mono={false}
              value={`${(connection.keyPreview ?? 'msk_').replace('…', '')}••••••••••••`}
              actions={rotateButton(t`Rotate`)}
            />
            <CredentialRow
              label={<Trans>Base URL</Trans>}
              mono={false}
              value={connection.setup.baseUrl}
              copyValue={connection.setup.baseUrl}
              copyLabel={t`Copy the base URL`}
            />
          </>
        )}
        {!fresh && (
          <EnvSnippet
            title={<Trans>.env snippet (secret masked: shown only at creation or rotation)</Trans>}
            snippet={connection.maskedSnippet}
            copyLabel={t`Copy the .env snippet`}
          />
        )}
        <div className="flex justify-end border-t border-ms-border pt-[18px]">
          <ConfirmDialog
            danger
            trigger={<Button variant="danger" />}
            triggerLabel={<Trans>Delete the connection</Trans>}
            title={<Trans>Delete the connection {name}?</Trans>}
            description={
              <Trans>
                Its credentials stop working and its webhook endpoints are deleted. Captured
                messages stay in the workspace.
              </Trans>
            }
            confirmLabel={<Trans>Delete</Trans>}
            onConfirm={async () => {
              await remove.mutateAsync(connection.id)
              onDeleted()
            }}
          />
        </div>
      </div>
    </div>
  )
}
