import { Trans, useLingui } from '@lingui/react/macro'
import type { ConnectionKind } from '@mailsink/contracts'
import { SegmentedControl, Switch } from '@mailsink/ui'
import { useId } from 'react'
import { KIND_OPTIONS } from '../connections/kinds'

// « Add a first connection » of the new workspace dialog: the switch, then the kind.
export function FirstConnectionFields({
  enabled,
  onEnabledChange,
  kind,
  onKindChange,
}: Readonly<{
  enabled: boolean
  onEnabledChange: (on: boolean) => void
  kind: ConnectionKind
  onKindChange: (kind: ConnectionKind) => void
}>) {
  const { t } = useLingui()
  const switchId = useId()
  return (
    <div className="flex flex-col gap-[13px] rounded-md border border-ms-border p-4">
      <label htmlFor={switchId} className="flex items-center gap-[13px] text-sm">
        <Switch id={switchId} checked={enabled} onCheckedChange={onEnabledChange} />
        <Trans>Add a first connection</Trans>
      </label>
      {enabled && (
        <SegmentedControl
          aria-label={t`Connection kind`}
          options={KIND_OPTIONS}
          value={kind}
          onValueChange={onKindChange}
        />
      )}
    </div>
  )
}
