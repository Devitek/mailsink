import { Trans } from '@lingui/react/macro'
import type { TemplateView } from '@mailsink/contracts'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@mailsink/ui'
import { type ReactElement, type ReactNode, useState } from 'react'
import { TemplateForm } from './template-form-view'

type TemplateEditorProps = {
  slug: string
  /** The template to edit; absent: a new one. */
  template?: TemplateView
  trigger: ReactElement
  triggerLabel: ReactNode
}

// Brevo template editor (#43): the fields on the left, the rendered preview on the right.
export function TemplateEditor({ slug, template, trigger, triggerLabel }: TemplateEditorProps) {
  const [open, setOpen] = useState(false)
  const id = template?.externalId
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent className="w-[min(1100px,calc(100vw-24px))]">
        <DialogHeader>
          <DialogTitle>
            {template ? <Trans>Edit template {id}</Trans> : <Trans>New Brevo template</Trans>}
          </DialogTitle>
          <DialogDescription>
            <Trans>
              The numeric id is the templateId a Brevo client sends; it cannot change afterwards.
            </Trans>
          </DialogDescription>
        </DialogHeader>
        {open && <TemplateForm slug={slug} template={template} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  )
}
