import { Trans, useLingui } from '@lingui/react/macro'
import { Button, type ButtonProps } from '@mailsink/ui'
import { useCopy } from './use-copy'

type CopyButtonProps = Omit<ButtonProps, 'onClick' | 'children' | 'value'> & {
  value: string
  /** Accessible name, e.g. « Copy SMTP_PASS »; the visible text stays « Copy ». */
  label?: string
  /** Text of the confirmation toast; « Copied to the clipboard » by default. */
  done?: string
}

// « Copier » of the prototype: writes the value to the clipboard, a toast confirms it.
export function CopyButton({ value, label, done, size = 'md', ...props }: CopyButtonProps) {
  const { t } = useLingui()
  const copy = useCopy()
  return (
    <Button
      type="button"
      size={size}
      aria-label={label ?? t`Copy`}
      onClick={() => void copy(value, done)}
      className="min-w-[72px]"
      {...props}
    >
      <Trans>Copy</Trans>
    </Button>
  )
}
