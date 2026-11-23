import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'

// Panel surface with the `xl` radius (14 px, B2-7): the sign-in card of brief 2. Width and
// padding are the caller's (420 px and 32 px on the sign-in screen).
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn('rounded-xl border border-ms-border bg-ms-panel text-ms-text', className)}
      {...props}
    />
  )
}
