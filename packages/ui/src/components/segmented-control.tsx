import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

// Segmented control of the prototype (retention 1h / 24h / 7d / 30d, connection kind,
// inbox filters, preview width): a radio group drawn as a 2 px inset track on the page
// background; the checked segment takes the hover surface and an inset strong border.
// Labels come translated from the app. The only segmented control of the UI (#106).

export type SegmentedOption<T extends string> = {
  value: T
  label: ReactNode
  /** Accessible name when the label is not plain text (a count next to it). */
  title?: string
}

export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedOption<T>[]
  value: T
  onValueChange: (value: T) => void
  /** Accessible name of the group (or use aria-labelledby). */
  'aria-label'?: string
  'aria-labelledby'?: string
  /** Monospace labels (durations, codes). */
  mono?: boolean
  /** Segments share the whole width (inbox filter bar). */
  fill?: boolean
  disabled?: boolean
  className?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  mono = false,
  fill = false,
  disabled,
  className,
  ...aria
}: SegmentedControlProps<T>) {
  return (
    <RadioGroup
      data-slot="segmented-control"
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      disabled={disabled}
      className={cn(
        'inline-flex gap-0.5 self-start rounded-md border border-ms-border bg-ms-bg p-0.5',
        fill && 'flex self-stretch',
        className,
      )}
      {...aria}
    >
      {options.map((option) => (
        <Radio.Root
          key={option.value}
          value={option.value}
          aria-label={option.title}
          className={cn(
            'inline-flex h-control-sm cursor-pointer items-center justify-center gap-1.5 rounded-sm px-3.5 text-xs whitespace-nowrap text-ms-text-muted outline-none transition-colors duration-fast ease-ms hover:text-ms-text focus-visible:focus-ring data-checked:bg-ms-hover data-checked:text-ms-text data-checked:shadow-[inset_0_0_0_1px_var(--ms-border-strong)] data-disabled:cursor-not-allowed data-disabled:opacity-50',
            mono && 'font-mono',
            fill && 'min-w-0 flex-1',
          )}
        >
          {option.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}
