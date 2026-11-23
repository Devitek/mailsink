import { Trans, useLingui } from '@lingui/react/macro'
import { Button, DialogClose, DialogFooter } from '@mailsink/ui'
import type { ReactNode } from 'react'
import { TextField } from './form-fields'

// Pieces shared by the workspace dialogs (#38): the default rate limit field, the failure
// line and the Cancel / submit footer.

export function RateLimitField({
  name,
  value,
  onChange,
  onBlur,
  error,
}: Readonly<{
  name: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  error: string | undefined
}>) {
  const { t } = useLingui()
  return (
    <TextField
      label={<Trans>Default rate limit</Trans>}
      name={name}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      error={error}
      placeholder={t`unlimited`}
      inputMode="numeric"
      suffix="req/s"
      mono
    />
  )
}

/** A save that failed for another reason than a field: one line above the footer. */
export function FormFailure({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <p role="alert" className="text-sm text-ms-danger">
      {children}
    </p>
  )
}

/** « Cancel » closes the dialog untouched; the submit button waits for the server. */
export function DialogFormFooter({
  submitting,
  children,
}: Readonly<{ submitting: boolean; children: ReactNode }>) {
  return (
    <DialogFooter>
      <DialogClose render={<Button variant="outline" />}>
        <Trans>Cancel</Trans>
      </DialogClose>
      <Button type="submit" variant="primary" disabled={submitting}>
        {children}
      </Button>
    </DialogFooter>
  )
}
