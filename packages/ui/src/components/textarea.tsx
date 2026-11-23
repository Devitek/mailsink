import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'

// Multi-line input with the input styles (strong border on the page background, focus
// ring): template bodies, JSON samples.
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-[96px] w-full min-w-0 resize-y rounded-md border border-ms-border-strong bg-ms-bg px-3.5 py-2.5 text-sm text-ms-text transition-colors duration-fast ease-ms outline-none placeholder:text-ms-text-faint focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-ms-danger',
        className,
      )}
      {...props}
    />
  )
}
