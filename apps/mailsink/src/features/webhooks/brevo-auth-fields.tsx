import { Trans, useLingui } from '@lingui/react/macro'
import { SegmentedControl } from '@mailsink/ui'
import { useId } from 'react'
import { TextField } from '../workspaces/form-fields'
import type { BrevoAuthType, EndpointValues } from './endpoint-form'

type AuthValues = Pick<
  EndpointValues,
  'brevoAuthType' | 'brevoToken' | 'brevoUsername' | 'brevoPassword'
>

type BrevoAuthFieldsProps = {
  values: AuthValues
  onChange: <K extends keyof AuthValues>(name: K, value: AuthValues[K]) => void
  errors: Partial<Record<keyof AuthValues, string>>
  /** Credentials already saved: blank fields keep them. */
  stored: boolean
}

// Brevo webhooks carry no signature: the receiver authenticates them with a Bearer token
// or Basic credentials (D136). Credentials are write-only: an edit shows them blank.
export function BrevoAuthFields({ values, onChange, errors, stored }: BrevoAuthFieldsProps) {
  const { t } = useLingui()
  const labelId = useId()
  const keep = stored ? t`unchanged` : undefined
  return (
    <div className="flex flex-col gap-3">
      <span id={labelId} className="text-xs font-medium text-ms-text-muted">
        <Trans>Authentication sent by Brevo</Trans>
      </span>
      <SegmentedControl<BrevoAuthType>
        aria-labelledby={labelId}
        options={[
          { value: 'none', label: t`None` },
          { value: 'bearer', label: 'Bearer' },
          { value: 'basic', label: 'Basic' },
        ]}
        value={values.brevoAuthType}
        onValueChange={(type) => onChange('brevoAuthType', type)}
      />
      {values.brevoAuthType === 'bearer' && (
        <TextField
          label={<Trans>Token</Trans>}
          name="brevoToken"
          value={values.brevoToken}
          onChange={(v) => onChange('brevoToken', v)}
          error={errors.brevoToken}
          placeholder={keep}
          mono
        />
      )}
      {values.brevoAuthType === 'basic' && (
        <div className="grid grid-cols-2 gap-[13px]">
          <TextField
            label={<Trans>Username</Trans>}
            name="brevoUsername"
            value={values.brevoUsername}
            onChange={(v) => onChange('brevoUsername', v)}
            error={errors.brevoUsername}
            mono
          />
          <TextField
            label={<Trans>Password</Trans>}
            name="brevoPassword"
            value={values.brevoPassword}
            onChange={(v) => onChange('brevoPassword', v)}
            error={errors.brevoPassword}
            placeholder={keep}
            mono
          />
        </div>
      )}
    </div>
  )
}
