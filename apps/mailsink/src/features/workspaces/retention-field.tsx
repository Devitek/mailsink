import { Trans } from '@lingui/react/macro'
import { SegmentedControl } from '@mailsink/ui'
import { useId } from 'react'
import { RETENTION_PRESETS } from './workspace-form'

const PRESETS = Object.keys(RETENTION_PRESETS).map((value) => ({ value, label: value }))

// « Rétention par défaut » of the prototype: 1h / 24h / 7d / 30d. A retention set through
// the Admin API outside the presets shows as one more segment, in seconds, kept as is.
export function RetentionField({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (value: string) => void }>) {
  const labelId = useId()
  const custom = value in RETENTION_PRESETS ? [] : [{ value, label: `${value}s` }]
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-xs font-medium text-ms-text-muted">
        <Trans>Default retention</Trans>
      </span>
      <SegmentedControl
        aria-labelledby={labelId}
        options={[...custom, ...PRESETS]}
        value={value}
        onValueChange={onChange}
        mono
      />
    </div>
  )
}
