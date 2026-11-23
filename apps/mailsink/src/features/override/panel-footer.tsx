import { Trans } from '@lingui/react/macro'
import { Button, SheetFooter } from '@mailsink/ui'
import { useState } from 'react'
import { anyOn, deliveredRemainder } from './override-form'
import type { OverrideForm } from './use-override-form'

type PanelFooterProps = {
  form: OverrideForm
  /** The target has an active override to reset. */
  canReset: boolean
  failed: boolean
  onReset: () => Promise<void>
}

// Footer of the override panel (#42): « Reset to defaults » asks for a confirmation in place
// (prototype), « Apply the override » submits the form once it is valid.
export function PanelFooter({ form, canReset, failed, onReset }: PanelFooterProps) {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)

  async function reset() {
    setPending(true)
    try {
      await onReset()
    } catch {
      setConfirming(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <SheetFooter className="flex-wrap items-center justify-start gap-2.5">
      <form.Subscribe selector={(s) => s.submissionAttempts > 0 && !anyOn(s.values)}>
        {(nothing) =>
          (failed || nothing) && (
            <p role="alert" className="basis-full text-xs text-ms-danger">
              {failed ? (
                <Trans>That did not work. Try again.</Trans>
              ) : (
                <Trans>Turn on at least one setting to override.</Trans>
              )}
            </p>
          )
        }
      </form.Subscribe>
      {confirming ? (
        <>
          <span className="flex-[1_1_180px] text-xs text-ms-danger">
            <Trans>Restore the settings of this target?</Trans>
          </span>
          <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
            <Trans>Cancel</Trans>
          </Button>
          <Button type="button" variant="danger" disabled={pending} onClick={reset}>
            <Trans>Confirm the reset</Trans>
          </Button>
        </>
      ) : (
        <>
          <Button
            type="button"
            variant="ghost"
            disabled={!canReset}
            onClick={() => setConfirming(true)}
          >
            <Trans>Reset to defaults</Trans>
          </Button>
          <div className="flex-1" />
          <form.Subscribe
            selector={(s) =>
              s.isSubmitting || (s.values.ratesOn && deliveredRemainder(s.values.rates) < 0)
            }
          >
            {(blocked) => (
              <Button type="submit" variant="primary" disabled={blocked}>
                <Trans>Apply the override</Trans>
              </Button>
            )}
          </form.Subscribe>
        </>
      )}
    </SheetFooter>
  )
}
