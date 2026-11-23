import { type ReactNode, useEffect, useState } from 'react'
import { cn } from '../lib/cn'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

// Faceted filter of a DataTable (shadcn « data table faceted filter » on a Base UI
// popover): a dashed trigger with the facet title and the chosen values, a list of
// checkable values with optional counts, and a clear action. Server-side filtering: the
// caller owns the selection (usually the URL). `multiple: false` keeps one value at most
// (checking one unchecks the other).

export interface DataTableFacetOption {
  value: string
  label: ReactNode
  /** Plain text of the label (trigger summary, accessible name). */
  text: string
  count?: number
}

export interface DataTableFacetProps {
  title: string
  options: readonly DataTableFacetOption[]
  selected: readonly string[]
  onChange: (values: string[]) => void
  multiple?: boolean
  /** Translated « Clear filter ». */
  clearLabel: string
  className?: string
}

export function DataTableFacet({
  title,
  options,
  selected,
  onChange,
  multiple = true,
  clearLabel,
  className,
}: Readonly<DataTableFacetProps>) {
  // The selection shows at once, before the caller's state (often a navigation) catches up.
  const [current, setCurrent] = useState<readonly string[]>(selected)
  const key = selected.join('\n')
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `selected`
  useEffect(() => setCurrent(selected), [key])
  const chosen = options.filter((o) => current.includes(o.value))
  const change = (values: string[]) => {
    setCurrent(values)
    onChange(values)
  }
  const toggle = (value: string) => {
    const on = current.includes(value)
    if (!multiple) return change(on ? [] : [value])
    change(on ? current.filter((v) => v !== value) : [...current, value])
  }
  return (
    <Popover>
      <PopoverTrigger
        data-slot="data-table-facet"
        className={cn(
          'inline-flex h-control-md max-w-full cursor-pointer items-center gap-2 rounded-md border border-dashed border-ms-border-strong bg-transparent px-3 text-xs text-ms-text-muted outline-none transition-colors duration-fast ease-ms hover:bg-ms-hover hover:text-ms-text focus-visible:focus-ring aria-expanded:bg-ms-hover data-[active=true]:border-solid data-[active=true]:text-ms-text',
          className,
        )}
        data-active={chosen.length > 0}
      >
        <span aria-hidden className="text-ms-text-faint">
          {chosen.length ? '●' : '+'}
        </span>
        {title}
        {chosen.length > 0 && (
          <span className="truncate border-l border-ms-border pl-2 font-mono text-badge">
            {chosen.length > 2 ? chosen.length : chosen.map((o) => o.text).join(', ')}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1.5">
        <fieldset aria-label={title} className="flex flex-col">
          {options.map((option) => {
            const on = current.includes(option.value)
            return (
              <label
                key={option.value}
                className="flex h-8 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-xs hover:bg-ms-hover has-focus-visible:bg-ms-hover"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(option.value)}
                  className="size-3.5 cursor-pointer accent-(--ms-accent)"
                />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.count !== undefined && (
                  <span className="font-mono text-badge text-ms-text-faint">{option.count}</span>
                )}
              </label>
            )
          })}
        </fieldset>
        {chosen.length > 0 && (
          <button
            type="button"
            onClick={() => change([])}
            className="mt-1 h-8 w-full cursor-pointer rounded-sm border-t border-ms-border text-xs text-ms-text-muted outline-none hover:bg-ms-hover hover:text-ms-text focus-visible:focus-ring"
          >
            {clearLabel}
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
