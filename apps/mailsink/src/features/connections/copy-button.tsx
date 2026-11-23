import { Trans, useLingui } from '@lingui/react/macro'
import { Button, type ButtonProps } from '@mailsink/ui'
import { useEffect, useState } from 'react'

type CopyButtonProps = Omit<ButtonProps, 'onClick' | 'children' | 'value'> & {
  value: string
  /** Accessible name, e.g. « Copy SMTP_PASS »; the visible text stays « Copy ». */
  label?: string
}

// « Copier » of the prototype: writes the value to the clipboard and reads « Copied » for
// a moment (no toast in the design system yet).
export function CopyButton({ value, label, size = 'md', ...props }: CopyButtonProps) {
  const { t } = useLingui()
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), 1600)
    return () => clearTimeout(timer)
  }, [state])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setState('copied')
    } catch {
      setState('failed')
    }
  }

  return (
    <Button
      type="button"
      size={size}
      aria-label={label ?? t`Copy`}
      onClick={copy}
      className="min-w-[72px]"
      {...props}
    >
      <span aria-live="polite">
        {state === 'copied' ? (
          <Trans>Copied</Trans>
        ) : state === 'failed' ? (
          <Trans>Copy failed</Trans>
        ) : (
          <Trans>Copy</Trans>
        )}
      </span>
    </Button>
  )
}
