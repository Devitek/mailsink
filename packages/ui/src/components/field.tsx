import { Field as FieldPrimitive } from '@base-ui/react/field'
import { cn } from '../lib/cn'

// Base UI Field: the label, the description and the error are linked to the control inside
// (`for`, `aria-describedby`), and `invalid` sets `aria-invalid` on it.

export function Field({ className, ...props }: FieldPrimitive.Root.Props) {
  return (
    <FieldPrimitive.Root
      data-slot="field"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

export function FieldLabel({ className, ...props }: FieldPrimitive.Label.Props) {
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      className={cn('text-sm font-medium text-ms-text', className)}
      {...props}
    />
  )
}

export function FieldDescription({ className, ...props }: FieldPrimitive.Description.Props) {
  return (
    <FieldPrimitive.Description
      data-slot="field-description"
      className={cn('text-xs text-ms-text-muted', className)}
      {...props}
    />
  )
}

/** Errors use the danger alias of the status colour (B2-5). */
export function FieldError({ className, ...props }: FieldPrimitive.Error.Props) {
  return (
    <FieldPrimitive.Error
      data-slot="field-error"
      className={cn('text-sm leading-normal text-ms-danger', className)}
      {...props}
    />
  )
}

export const FieldControl = FieldPrimitive.Control
