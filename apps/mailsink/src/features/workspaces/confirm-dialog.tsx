import { Trans } from '@lingui/react/macro'
import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from '@mailsink/ui'
import { type ReactElement, type ReactNode, useId, useState } from 'react'

type ConfirmDialogProps = {
  /** Element opening the dialog (rendered as the Base UI trigger) and its content. */
  trigger: ReactElement
  triggerLabel: ReactNode
  title: ReactNode
  description: ReactNode
  confirmLabel: ReactNode
  /** Resolves once done; the dialog closes then, or shows the error state on failure. */
  onConfirm: () => Promise<unknown>
  /** Destructive action: danger button. */
  danger?: boolean
  /** Text the user must type to enable the confirmation (a workspace slug). */
  requireText?: string
  requireLabel?: ReactNode
}

// Confirmation before an irreversible action (#38): delete a workspace or a connection,
// rotate a secret. Escape, the backdrop and Cancel leave everything untouched.
export function ConfirmDialog({
  trigger,
  triggerLabel,
  title,
  description,
  confirmLabel,
  onConfirm,
  danger = false,
  requireText,
  requireLabel,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [state, setState] = useState<'idle' | 'pending' | 'failed'>('idle')
  const inputId = useId()
  const ready = requireText === undefined || typed === requireText

  function change(next: boolean) {
    setOpen(next)
    if (!next) {
      setTyped('')
      setState('idle')
    }
  }

  async function confirm() {
    setState('pending')
    try {
      await onConfirm()
      change(false)
    } catch {
      setState('failed')
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent role="alertdialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-sm text-ms-text-muted">
            {description}
          </DialogDescription>
        </DialogHeader>
        {(requireText !== undefined || state === 'failed') && (
          <DialogBody>
            {requireText !== undefined && (
              <div className="flex flex-col gap-2">
                <label htmlFor={inputId} className="text-xs font-medium text-ms-text-muted">
                  {requireLabel}
                </label>
                <Input
                  id={inputId}
                  value={typed}
                  onValueChange={(value: string) => setTyped(value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                />
              </div>
            )}
            {state === 'failed' && (
              <p role="alert" className="text-sm text-ms-danger">
                <Trans>That did not work. Try again.</Trans>
              </p>
            )}
          </DialogBody>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            <Trans>Cancel</Trans>
          </DialogClose>
          <Button
            variant={danger ? 'danger' : 'primary'}
            disabled={!ready || state === 'pending'}
            onClick={confirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
