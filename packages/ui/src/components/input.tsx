import { Input as InputPrimitive } from '@base-ui/react/input'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'

// shadcn/ui input (base-nova) at the prototype measures: 30 px, 14 px side padding,
// strong border on the page background, accent text border and soft ring on focus.
export const inputVariants = cva(
  'w-full min-w-0 rounded-md border border-ms-border-strong bg-ms-bg px-3.5 text-ms-text transition-colors duration-fast ease-ms outline-none placeholder:text-ms-text-faint focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-ms-danger',
  {
    variants: {
      inputSize: {
        sm: 'h-control-sm rounded-sm px-2.5 text-xs',
        md: 'h-control-md text-sm',
        lg: 'h-control-lg text-sm',
        xl: 'h-control-xl text-md',
      },
    },
    defaultVariants: { inputSize: 'md' },
  },
)

export type InputProps = ComponentProps<typeof InputPrimitive> & VariantProps<typeof inputVariants>

export function Input({ className, inputSize, ...props }: InputProps) {
  return (
    <InputPrimitive
      data-slot="input"
      className={cn(inputVariants({ inputSize }), className)}
      {...props}
    />
  )
}
