import { Trans, useLingui } from '@lingui/react/macro'
import { Button, cn, Switch } from '@mailsink/ui'
import { useId } from 'react'
import type { SettingsPage } from '../../server-fns/settings-types'
import type { EndpointRow } from '../../server-fns/webhooks-types'
import { ConfirmDialog } from '../workspaces/confirm-dialog'
import { EndpointDialog } from './endpoint-dialog'
import { EventList } from './event-list'
import { FORMATS, hasSigningSecret } from './formats'
import { LastDelivery } from './last-delivery'
import { useEndpointMutations } from './queries'
import { SecretLine } from './secret-line'
import { TestSend } from './test-send'

type EndpointCardProps = {
  page: SettingsPage
  endpoint: EndpointRow
  /** Clear secret issued on this page (creation or rotation). */
  freshSecret?: string
  onSecret: (secret: string | null) => void
}

// One endpoint of the prototype list: enable switch, URL, « Test send », then scope and
// format, subscribed events in the format's dialect, secret or Brevo auth, last delivery.
export function EndpointCard({ page, endpoint, freshSecret, onSecret }: EndpointCardProps) {
  const { t } = useLingui()
  const switchId = useId()
  const { update, remove } = useEndpointMutations(page.workspace.slug)
  const format = FORMATS[endpoint.payloadFormat]
  const connection = page.connections.find((c) => c.id === endpoint.connectionId)
  const scope = connection?.name ?? t`Workspace`
  const url = endpoint.url
  const { short: shortName, signature } = format

  return (
    <article
      aria-label={url}
      data-testid="webhook-endpoint"
      className={cn(
        'flex flex-col gap-[13px] rounded-lg border border-ms-border bg-ms-panel p-[19px]',
        !endpoint.enabled && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-center gap-[13px]">
        <Switch
          id={switchId}
          aria-label={t`Enabled`}
          checked={endpoint.enabled}
          disabled={update.isPending}
          onCheckedChange={(on: boolean) =>
            update.mutate({ id: endpoint.id, patch: { enabled: on } })
          }
        />
        <span className="min-w-0 flex-[1_1_280px] truncate font-mono text-sm" title={url}>
          {url}
        </span>
        <TestSend slug={page.workspace.slug} endpoint={endpoint} />
        <EndpointDialog
          page={page}
          endpoint={endpoint}
          trigger={<Button size="sm" />}
          triggerLabel={<Trans>Edit</Trans>}
          onSaved={(saved) => onSecret(saved.secret)}
        />
        <ConfirmDialog
          danger
          trigger={<Button variant="danger" size="sm" />}
          triggerLabel={<Trans>Delete</Trans>}
          title={<Trans>Delete the endpoint {url}?</Trans>}
          description={
            <Trans>It stops receiving events at once. Its delivery log is deleted with it.</Trans>
          }
          confirmLabel={<Trans>Delete</Trans>}
          onConfirm={() => remove.mutateAsync(endpoint.id)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2.5 text-xs">
        <span className="text-ms-text-faint">
          <Trans>Scope</Trans>
        </span>
        <span className="font-mono">{scope}</span>
        <span className="pl-2 text-ms-text-faint">
          <Trans>Format</Trans>
        </span>
        <span className="font-medium">{format.label}</span>
        <span className="flex-1" />
        <span
          className={cn(
            'inline-flex h-[22px] items-center rounded-xs border border-current/40 bg-current/10 px-[11px] font-mono text-label font-medium',
            format.tone,
          )}
        >
          <Trans>
            Format: {shortName} · {signature}
          </Trans>
        </span>
      </div>
      <EventList names={endpoint.events} unsupported={endpoint.unsupportedEvents} />
      <div className="flex flex-wrap items-center gap-[13px] text-xs text-ms-text-faint">
        {hasSigningSecret(endpoint.payloadFormat) ? (
          <SecretLine
            slug={page.workspace.slug}
            endpoint={endpoint}
            fresh={freshSecret}
            onRotated={onSecret}
          />
        ) : (
          <span>
            <Trans>Auth</Trans>{' '}
            <span className="font-mono text-ms-text-muted">
              {endpoint.brevoAuth.type === 'basic'
                ? `Basic ${endpoint.brevoAuth.username ?? ''}`
                : endpoint.brevoAuth.type === 'bearer'
                  ? 'Bearer ••••••••'
                  : t`none`}
            </span>
          </span>
        )}
        <span className="border-l border-ms-border-strong pl-[11px] font-mono text-label">
          {format.headers}
        </span>
        <span className="flex-1" />
        <LastDelivery delivery={endpoint.lastDelivery} />
      </div>
    </article>
  )
}
