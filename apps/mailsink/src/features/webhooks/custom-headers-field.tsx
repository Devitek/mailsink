import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Input } from '@mailsink/ui'
import type { HeaderValue } from './endpoint-form'

const MAX_HEADERS = 10

type CustomHeadersFieldProps = {
  value: HeaderValue[]
  onChange: (headers: HeaderValue[]) => void
  /** Error per row index (invalid or reserved name). */
  errors: Record<number, string>
}

// Custom headers sent with every delivery, under the format's own ones (D137): at most 10;
// content type, auth and signature headers are reserved (the server says which).
export function CustomHeadersField({ value, onChange, errors }: CustomHeadersFieldProps) {
  const { t } = useLingui()
  const set = (index: number, patch: Partial<HeaderValue>) =>
    onChange(value.map((h, i) => (i === index ? { ...h, ...patch } : h)))
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-xs font-medium text-ms-text-muted">
        <Trans>Custom headers</Trans>
      </legend>
      {value.map((header, index) => {
        const row = index + 1
        return (
          // Rows have no identity of their own; the index is stable while editing.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <div key={index} className="flex flex-col gap-1">
            <div className="flex gap-2">
              <Input
                aria-label={t`Header name ${row}`}
                aria-invalid={errors[index] ? true : undefined}
                value={header.key}
                onValueChange={(key: string) => set(index, { key })}
                placeholder="X-Env"
                className="flex-[0_1_200px] font-mono"
              />
              <Input
                aria-label={t`Header value ${row}`}
                value={header.value}
                onValueChange={(v: string) => set(index, { value: v })}
                className="flex-1 font-mono"
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={t`Remove header ${row}`}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                ×
              </Button>
            </div>
            {errors[index] && <span className="text-xs text-ms-danger">{errors[index]}</span>}
          </div>
        )
      })}
      {value.length < MAX_HEADERS && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => onChange([...value, { key: '', value: '' }])}
        >
          <Trans>+ Add a header</Trans>
        </Button>
      )}
    </fieldset>
  )
}
