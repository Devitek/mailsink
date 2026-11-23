import { useLingui } from '@lingui/react/macro'
import { useForm } from '@tanstack/react-form'
import { anyOn, type OverrideValues } from './override-form'
import { overrideSchema } from './override-schema'

// TanStack Form of the override panel (#42), validated by the override schema on every
// change; the sections receive the typed form instance.

export function useOverrideForm(
  defaultValues: OverrideValues,
  onSubmit: (values: OverrideValues) => Promise<void>,
) {
  const { t } = useLingui()
  const schema = overrideSchema({
    nothingOn: t`Turn on at least one setting to override.`,
    percent: t`A whole percentage from 0 to 100.`,
    ratesOver: t`The rates add up to more than 100 %.`,
    delay: t`Whole milliseconds, from 0 to 600000.`,
    latencyOrder: t`maxMs must be greater than or equal to minMs.`,
    codes: t`Pick at least one code.`,
    limit: t`A whole number above 0.`,
    match: t`A pattern is required.`,
  })
  return useForm({
    defaultValues,
    // onChange only: errors written by a form-level onSubmit validator outlive the fix.
    // An empty override is caught here (the footer explains it) rather than as an error.
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      if (anyOn(value)) await onSubmit(value)
    },
  })
}

export type OverrideForm = ReturnType<typeof useOverrideForm>
