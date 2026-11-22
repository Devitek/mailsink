import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'

// shadcn/ui button (base-nova) at the prototype measures: controls 24 / 30 / 34 px
// (44 px on the sign-in screen, B2-6), radius 8 (6 below 30 px), 12.5 px text.
export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent font-medium whitespace-nowrap transition-colors duration-fast ease-ms outline-none select-none focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-ms-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        // Flat accent: dark ink on yellow, never white (IMPLEMENTATION 1).
        primary: 'bg-ms-accent font-semibold text-ms-on-accent hover:brightness-95',
        secondary:
          'border-ms-border-strong bg-ms-raised text-ms-text hover:bg-ms-hover aria-expanded:bg-ms-hover',
        outline:
          'border-ms-border-strong bg-transparent text-ms-text-muted hover:bg-ms-hover hover:text-ms-text',
        ghost:
          'bg-transparent text-ms-text-muted hover:bg-ms-hover hover:text-ms-text aria-expanded:bg-ms-hover',
        danger:
          'border-[color-mix(in_oklch,var(--ms-danger)_40%,transparent)] bg-[color-mix(in_oklch,var(--ms-danger)_12%,transparent)] text-ms-danger hover:bg-[color-mix(in_oklch,var(--ms-danger)_18%,transparent)]',
        link: 'h-auto border-0 px-0 text-ms-accent-text underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-control-sm rounded-sm px-3 text-xs',
        md: 'h-control-md px-[15px] text-sm',
        lg: 'h-control-lg px-[19px] text-sm',
        xl: 'h-control-xl px-5 text-md',
        'icon-sm': 'size-control-sm rounded-sm',
        icon: 'size-control-md',
        'icon-lg': 'size-control-lg',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}
