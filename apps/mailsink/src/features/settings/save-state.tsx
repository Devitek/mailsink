import { Trans } from '@lingui/react/macro'
import { Button } from '@mailsink/ui'

type SaveStateProps = {
  /** The form is being submitted. */
  pending: boolean
  /** The last save succeeded / failed (cleared when the next one starts). */
  saved: boolean
  failed: boolean
}

// Footer of a settings form: the outcome of the last save, then « Save ».
export function SaveState({ pending, saved, failed }: SaveStateProps) {
  return (
    <div className="mt-4 flex items-center justify-end gap-3">
      <span aria-live="polite" className="text-xs">
        {failed ? (
          <span role="alert" className="text-ms-danger">
            <Trans>The settings could not be saved. Try again.</Trans>
          </span>
        ) : saved && !pending ? (
          <span className="text-ms-text-muted">
            <Trans>Saved.</Trans>
          </span>
        ) : null}
      </span>
      <Button type="submit" variant="primary" disabled={pending}>
        <Trans>Save</Trans>
      </Button>
    </div>
  )
}
