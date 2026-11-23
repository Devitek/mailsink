import { Trans, useLingui } from '@lingui/react/macro'
import type { LogsSearch, LogsTab } from '@mailsink/contracts'
import {
  Button,
  Input,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  Select,
} from '@mailsink/ui'
import { useForm } from '@tanstack/react-form'
import { type ReactNode, useId, useState } from 'react'
import type { SetLogsSearch } from './logs-pager'
import {
  activeCount,
  changeOf,
  METHODS,
  type MoreFilterValues,
  moreFiltersSchema,
  moreKeysOf,
  valuesOf,
} from './more-filters'

const trigger =
  'inline-flex h-control-md cursor-pointer items-center gap-2 rounded-md border border-dashed border-ms-border-strong bg-transparent px-3 text-xs text-ms-text-muted outline-none transition-colors duration-fast ease-ms hover:bg-ms-hover hover:text-ms-text focus-visible:focus-ring aria-expanded:bg-ms-hover data-[active=true]:border-solid data-[active=true]:text-ms-text'

function Row({
  label,
  error,
  children,
}: Readonly<{ label: ReactNode; error?: string; children: (id: string) => ReactNode }>) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-ms-text-muted">
        {label}
      </label>
      {children(id)}
      {error && <span className="text-xs text-ms-danger">{error}</span>}
    </div>
  )
}

const errorOf = (errors: readonly unknown[]) => {
  const first = errors[0] as { message?: string } | string | undefined
  return typeof first === 'string' ? first : first?.message
}

// « More filters » popover of the logs toolbar: message id, dates, method and error code
// of the tab, written to the URL on « Apply » (the page goes back to the first).
export function LogsMoreFilters({
  tab,
  search,
  setSearch,
}: Readonly<{ tab: LogsTab; search: LogsSearch; setSearch: SetLogsSearch }>) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const keys = moreKeysOf(tab)
  const count = activeCount(search, tab)
  const schema = moreFiltersSchema({
    messageId: t`A message id starts with msg_.`,
    range: t`The end comes before the start.`,
  })
  const form = useForm({
    defaultValues: valuesOf(search),
    validators: { onSubmit: schema },
    onSubmit: ({ value }) => {
      setSearch(changeOf(value, tab))
      setOpen(false)
    },
  })
  const text = (name: 'messageId' | 'errorCode', label: ReactNode, placeholder: string) => (
    <form.Field name={name}>
      {(field) => (
        <Row label={label} error={errorOf(field.state.meta.errors)}>
          {(id) => (
            <Input
              id={id}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder={placeholder}
              className="font-mono"
            />
          )}
        </Row>
      )}
    </form.Field>
  )
  const date = (name: 'since' | 'until', label: ReactNode) => (
    <form.Field name={name}>
      {(field) => (
        <Row label={label} error={errorOf(field.state.meta.errors)}>
          {(id) => (
            <Input
              id={id}
              type="datetime-local"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className="font-mono"
            />
          )}
        </Row>
      )}
    </form.Field>
  )
  const methods = [{ value: 'any', label: t`Any` }, ...METHODS.map((m) => ({ value: m, label: m }))]

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) form.reset(valuesOf(search) satisfies MoreFilterValues)
        setOpen(next)
      }}
    >
      <PopoverTrigger className={trigger} data-active={count > 0}>
        <span aria-hidden className="text-ms-text-faint">
          {count ? '●' : '+'}
        </span>
        <Trans>More filters</Trans>
        {count > 0 && (
          <span className="border-l border-ms-border pl-2 font-mono text-badge">{count}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-4">
        <form
          noValidate
          aria-label={t`More filters`}
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          {text('messageId', <Trans>Message id</Trans>, 'msg_…')}
          {keys.includes('since') && date('since', <Trans>Since</Trans>)}
          {keys.includes('until') && date('until', <Trans>Until</Trans>)}
          {keys.includes('method') && (
            <form.Field name="method">
              {(field) => (
                <Row label={<Trans>Method</Trans>}>
                  {(id) => (
                    <Select
                      id={id}
                      options={methods}
                      value={field.state.value || 'any'}
                      onValueChange={(v) => field.handleChange(v === 'any' ? '' : v)}
                      mono
                    />
                  )}
                </Row>
              )}
            </form.Field>
          )}
          {keys.includes('errorCode') &&
            text('errorCode', <Trans>Error code</Trans>, 'rate_limited')}
          <div className="mt-1 flex justify-end gap-2">
            <PopoverClose
              render={<Button variant="ghost" size="sm" />}
              onClick={() => setSearch(Object.fromEntries(keys.map((k) => [k, undefined])))}
            >
              <Trans>Clear</Trans>
            </PopoverClose>
            <Button type="submit" variant="primary" size="sm">
              <Trans>Apply</Trans>
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
