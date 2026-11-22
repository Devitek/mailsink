import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import type { DeliveryStatus } from '@mailsink/contracts'
import { cva, type VariantProps } from 'class-variance-authority'
import type { CSSProperties } from 'react'
import { cn } from '../lib/cn'

/** `soft_bounce` -> `var(--ms-status-soft-bounce)`. */
export function statusColorVar(status: DeliveryStatus): string {
  return `var(--ms-status-${status.replace(/_/g, '-')})`
}

// Prototype measures: 18 px in lists, 20 px in the inspector header; mono 500, text in the
// status colour on a 14 % tint (TOKENS.md). Statuses are technical values, never translated.
const statusBadgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-xs font-mono font-medium whitespace-nowrap text-(--status) bg-[color-mix(in_oklch,var(--status)_14%,transparent)]',
  {
    variants: {
      size: {
        sm: 'h-[18px] px-2 text-badge',
        md: 'h-5 px-[9px] text-label',
      },
    },
    defaultVariants: { size: 'sm' },
  },
)

export type StatusBadgeProps = useRender.ComponentProps<'span'> &
  VariantProps<typeof statusBadgeVariants> & {
    status: DeliveryStatus
    /** Leading dot, as in the inspector header. */
    dot?: boolean
  }

export function StatusBadge({
  status,
  dot = false,
  size,
  className,
  render,
  ...props
}: StatusBadgeProps) {
  const style = { '--status': statusColorVar(status) } as CSSProperties
  return useRender({
    defaultTagName: 'span',
    render,
    props: mergeProps<'span'>(
      {
        className: cn(statusBadgeVariants({ size }), className),
        style,
        children: (
          <>
            {dot && <span data-dot aria-hidden className="size-1.5 rounded-full bg-current" />}
            {status}
          </>
        ),
      },
      props,
      { 'data-slot': 'status-badge', 'data-status': status } as Record<string, string>,
    ),
  })
}
