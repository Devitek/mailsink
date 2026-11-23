import { Trans } from '@lingui/react/macro'
import type { WebhookEndpointWithSecret } from '@mailsink/contracts'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@mailsink/ui'
import { type ReactElement, type ReactNode, useState } from 'react'
import type { SettingsPage } from '../../server-fns/settings-types'
import type { EndpointRow } from '../../server-fns/webhooks-types'
import { EndpointForm } from './endpoint-form-view'

type EndpointDialogProps = {
  page: SettingsPage
  /** The endpoint to edit; absent: a new one. */
  endpoint?: EndpointRow
  trigger: ReactElement
  triggerLabel: ReactNode
  onSaved: (endpoint: WebhookEndpointWithSecret) => void
}

// Endpoint creation and edition (#43): the form on the left, the live payload preview on
// the right. Each opening starts from the saved values.
export function EndpointDialog({
  page,
  endpoint,
  trigger,
  triggerLabel,
  onSaved,
}: EndpointDialogProps) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent className="w-[min(980px,calc(100vw-24px))]">
        <DialogHeader>
          <DialogTitle>
            {endpoint ? <Trans>Edit the endpoint</Trans> : <Trans>New webhook endpoint</Trans>}
          </DialogTitle>
          <DialogDescription>
            <Trans>
              The scope picks which connections feed it; the format, what the receiver gets.
            </Trans>
          </DialogDescription>
        </DialogHeader>
        {open && (
          <EndpointForm
            page={page}
            endpoint={endpoint}
            onDone={(saved) => {
              onSaved(saved)
              setOpen(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
