import { Trans, useLingui } from '@lingui/react/macro'
import type { PayloadFormat } from '@mailsink/contracts'
import { SegmentedControl, Select } from '@mailsink/ui'
import { useId } from 'react'
import type { SettingsConnection } from '../../server-fns/settings-types'
import { KIND_LABELS } from '../connections/kinds'
import { formatForScope } from './endpoint-form'
import { FORMAT_ORDER, FORMATS } from './formats'

/** Select value of the Workspace scope (a connection id is never this string). */
const WORKSPACE = 'workspace'

type ScopeFormatFieldsProps = {
  connections: readonly SettingsConnection[]
  /** Empty = Workspace scope. */
  connectionId: string
  format: PayloadFormat
  onScope: (connectionId: string) => void
  onFormat: (format: PayloadFormat) => void
}

// « Scope » and « Format » of the prototype endpoint card. The scope menu lists the
// Workspace (every connection) then each connection; the format follows the scope (D20)
// until it is picked by hand, and shows its signature scheme.
export function ScopeFormatFields({
  connections,
  connectionId,
  format,
  onScope,
  onFormat,
}: ScopeFormatFieldsProps) {
  const { t } = useLingui()
  const scopeId = useId()
  const formatId = useId()
  const connection = connections.find((c) => c.id === connectionId)
  const inherited = connection !== undefined && formatForScope(connections, connectionId) === format
  const options = [
    { value: WORKSPACE, label: t`Workspace`, hint: t`every connection` },
    ...connections.map((c) => ({ value: c.id, label: c.name, hint: KIND_LABELS[c.kind] })),
  ]
  const signature = FORMATS[format].signature

  return (
    <div className="flex flex-wrap gap-[21px]">
      <div className="flex flex-col gap-2">
        <span id={scopeId} className="text-xs font-medium text-ms-text-muted">
          <Trans>Scope</Trans>
        </span>
        <Select
          aria-labelledby={scopeId}
          options={options}
          value={connectionId || WORKSPACE}
          onValueChange={(value) => onScope(value === WORKSPACE ? '' : value)}
          mono
        />
      </div>
      <div className="flex flex-col gap-2">
        <span id={formatId} className="text-xs font-medium text-ms-text-muted">
          <Trans>Format</Trans>
        </span>
        <SegmentedControl<PayloadFormat>
          aria-labelledby={formatId}
          options={FORMAT_ORDER.map((value) => ({ value, label: FORMATS[value].short }))}
          value={format}
          onValueChange={onFormat}
        />
        <span className="text-label text-ms-text-faint">
          {inherited ? (
            <Trans>Inherited from the connection · {signature}</Trans>
          ) : (
            <Trans>Signature: {signature}</Trans>
          )}
        </span>
      </div>
    </div>
  )
}
