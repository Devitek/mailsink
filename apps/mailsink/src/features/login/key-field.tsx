import { Trans, useLingui } from '@lingui/react/macro'
import { Field, FieldError, FieldLabel, Input } from '@mailsink/ui'
import { type RefObject, useState } from 'react'

type KeyFieldProps = {
  value: string
  onChange: (value: string) => void
  inputRef: RefObject<HTMLInputElement | null>
  /** L1b: the key was refused. */
  invalid: boolean
  /** L1c: greyed and inactive while the key is checked. */
  disabled: boolean
}

const sideButton =
  'h-full shrink-0 cursor-pointer border-l border-ms-border px-[12px] text-sm text-ms-text-muted transition-colors duration-fast ease-ms outline-none hover:bg-ms-hover hover:text-ms-text focus-visible:bg-ms-hover focus-visible:text-ms-text disabled:cursor-not-allowed'

// Admin key field of L1a: masked by default, Show / Hide and Paste built into the field on
// the right, 44 px (48 px at 390). The error is linked through Base UI Field
// (aria-invalid, aria-describedby).
export function KeyField({ value, onChange, inputRef, invalid, disabled }: KeyFieldProps) {
  const { t } = useLingui()
  const [revealed, setRevealed] = useState(false)

  async function paste() {
    try {
      const text = (await navigator.clipboard.readText()).trim()
      if (text) onChange(text)
    } catch {
      // Clipboard refused: the visitor pastes with the keyboard instead.
    }
    inputRef.current?.focus()
  }

  return (
    <Field invalid={invalid} disabled={disabled} className="gap-[10px]">
      <FieldLabel>
        <Trans>Admin key</Trans>
      </FieldLabel>
      <div className="flex h-control-xl items-stretch overflow-hidden rounded-lg border border-ms-border-strong bg-ms-bg transition-colors duration-fast ease-ms focus-within:focus-ring has-[input[aria-invalid=true]]:border-ms-danger has-disabled:opacity-60 max-sm:h-[48px]">
        <Input
          ref={inputRef}
          autoFocus
          type={revealed ? 'text' : 'password'}
          name="key"
          autoComplete="current-password"
          spellCheck={false}
          autoCapitalize="off"
          placeholder="msk_admin_…"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-full flex-1 rounded-none border-0 bg-transparent px-[14px] font-mono text-md focus-visible:shadow-none disabled:opacity-100"
        />
        <button
          type="button"
          className={sideButton}
          disabled={disabled}
          aria-pressed={revealed}
          onClick={() => setRevealed((shown) => !shown)}
        >
          {revealed ? t`Hide` : t`Show`}
        </button>
        <button type="button" className={sideButton} disabled={disabled} onClick={paste}>
          <Trans>Paste</Trans>
        </button>
      </div>
      {invalid && (
        <FieldError match>
          <Trans>
            <strong className="font-semibold">Key rejected.</strong> Check that it matches{' '}
            <code className="font-mono">MAILSINK_ADMIN_KEY</code> on the server.
          </Trans>
        </FieldError>
      )}
    </Field>
  )
}
