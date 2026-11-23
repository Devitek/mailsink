import { Select as SelectPrimitive } from '@base-ui/react/select'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

// Select of the prototype menus (webhook « Scope » and « Format »): a 28 px trigger on the
// page background with a faint prefix label, a panel popup with a check on the chosen item
// and an optional faint second line. Labels come translated from the app.

export type SelectOption<T extends string> = {
  value: T
  label: string
  /** Faint text after the label (a connection kind, a signature scheme). */
  hint?: string
}

export type SelectProps<T extends string> = {
  options: readonly SelectOption<T>[]
  value: T
  onValueChange: (value: T) => void
  /** Faint text before the value inside the trigger (« Scope »). */
  prefix?: ReactNode
  'aria-label'?: string
  'aria-labelledby'?: string
  id?: string
  /** Monospace values (slugs, names). */
  mono?: boolean
  disabled?: boolean
  className?: string
}

export function Select<T extends string>({
  options,
  value,
  onValueChange,
  prefix,
  mono = false,
  disabled,
  className,
  id,
  ...aria
}: SelectProps<T>) {
  const items = options.map((o) => ({ value: o.value, label: o.label }))
  return (
    <SelectPrimitive.Root
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next as T)
      }}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        data-slot="select-trigger"
        className={cn(
          'flex h-control-sm cursor-pointer items-center gap-2 rounded-sm border border-ms-border-strong bg-ms-bg pr-2.5 pl-3.5 text-xs text-ms-text outline-none transition-colors duration-fast ease-ms hover:border-ms-text-faint focus-visible:focus-ring data-disabled:cursor-not-allowed data-disabled:opacity-50',
          className,
        )}
        {...aria}
      >
        {prefix && <span className="text-ms-text-faint">{prefix}</span>}
        <SelectPrimitive.Value className={cn('truncate', mono && 'font-mono')} />
        <SelectPrimitive.Icon className="text-[9px] text-ms-text-faint">▼</SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={4} alignItemWithTrigger={false} className="z-50">
          <SelectPrimitive.Popup className="max-h-[min(360px,var(--available-height))] min-w-[var(--anchor-width)] overflow-auto rounded-lg border border-ms-border-strong bg-ms-panel p-1 text-ms-text shadow-popover outline-none transition-[transform,opacity] duration-fast ease-ms data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
            <SelectPrimitive.List>
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="flex min-h-[34px] cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-xs outline-none select-none data-highlighted:bg-ms-hover"
                >
                  <span aria-hidden className="w-3 text-ms-accent-text">
                    <SelectPrimitive.ItemIndicator>✓</SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText className={cn('flex-1', mono && 'font-mono')}>
                    {option.label}
                  </SelectPrimitive.ItemText>
                  {option.hint && (
                    <span className="text-label text-ms-text-faint">{option.hint}</span>
                  )}
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
