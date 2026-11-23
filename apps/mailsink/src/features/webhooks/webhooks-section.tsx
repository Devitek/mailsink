import { Trans } from '@lingui/react/macro'
import { Button } from '@mailsink/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { SettingsPage } from '../../server-fns/settings-types'
import { SectionHeader } from '../settings/section-header'
import { EndpointCard } from './endpoint-card'
import { EndpointDialog } from './endpoint-dialog'
import { endpointsQuery } from './queries'

// « Endpoints webhook » section (#43, prototype « Paramètres > Webhooks »): one card per
// endpoint (every scope), « + Add an endpoint » opening the form. A secret issued by a
// creation or rotation stays in this page's memory, shown until the page is left.
export function WebhooksSection({ page }: Readonly<{ page: SettingsPage }>) {
  const slug = page.workspace.slug
  const { data: endpoints } = useSuspenseQuery(endpointsQuery(slug))
  const [fresh, setFresh] = useState<Record<string, string>>({})
  const remember = (id: string, secret: string | null) => {
    if (secret) setFresh((all) => ({ ...all, [id]: secret }))
  }

  return (
    <div>
      <SectionHeader
        title={<Trans>Webhook endpoints</Trans>}
        description={
          <Trans>Outgoing HTTP notifications, in the provider's native format or unified.</Trans>
        }
      >
        <EndpointDialog
          page={page}
          trigger={<Button variant="primary" size="sm" />}
          triggerLabel={<Trans>+ Add an endpoint</Trans>}
          onSaved={(endpoint) => remember(endpoint.id, endpoint.secret)}
        />
      </SectionHeader>
      <div className="flex flex-col gap-[13px]">
        {endpoints.map((endpoint) => (
          <EndpointCard
            key={endpoint.id}
            page={page}
            endpoint={endpoint}
            freshSecret={fresh[endpoint.id]}
            onSecret={(secret) => remember(endpoint.id, secret)}
          />
        ))}
        {endpoints.length === 0 && (
          <p className="rounded-lg border border-ms-border bg-ms-panel px-[19px] py-[22px] text-sm text-ms-text-faint">
            <Trans>No webhook endpoint yet: add one to receive delivery events.</Trans>
          </p>
        )}
      </div>
    </div>
  )
}
