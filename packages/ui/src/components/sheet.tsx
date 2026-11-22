import { Dialog as SheetPrimitive } from '@base-ui/react/dialog'
import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'
import { Button } from './button'

// shadcn/ui sheet (base-nova) shaped like the prototype drawers (override, log detail):
// right side, min(560px, 100vw), panel background, left border, 200 ms slide of 28 px.

export const Sheet = SheetPrimitive.Root
export const SheetTrigger = SheetPrimitive.Trigger
export const SheetClose = SheetPrimitive.Close
export const SheetPortal = SheetPrimitive.Portal

export function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-ms-overlay transition-opacity duration-fast ease-ms data-ending-style:opacity-0 data-starting-style:opacity-0',
        className,
      )}
      {...props}
    />
  )
}

export type SheetContentProps = SheetPrimitive.Popup.Props & {
  /** Accessible name of the close button, translated by the caller (UI strings use Lingui). */
  closeLabel?: string
}

export function SheetContent({ className, children, closeLabel, ...props }: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-[min(560px,100vw)] flex-col border-l border-ms-border bg-ms-panel text-ms-text shadow-sheet outline-none transition-[transform,opacity] duration-base ease-ms data-ending-style:translate-x-7 data-ending-style:opacity-0 data-starting-style:translate-x-7 data-starting-style:opacity-0',
          className,
        )}
        {...props}
      >
        {children}
        {closeLabel && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            aria-label={closeLabel}
            render={<Button variant="ghost" size="icon" className="absolute top-5 right-5" />}
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

export function SheetHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        'flex flex-col gap-0.5 border-b border-ms-border py-[22px] pr-16 pl-6',
        className,
      )}
      {...props}
    />
  )
}

export function SheetBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div data-slot="sheet-body" className={cn('flex-1 overflow-auto p-6', className)} {...props} />
  )
}

export function SheetFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        'mt-auto flex justify-end gap-2.5 border-t border-ms-border px-6 py-4',
        className,
      )}
      {...props}
    />
  )
}

export function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-heading font-semibold tracking-[-0.015em]', className)}
      {...props}
    />
  )
}

export function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-xs text-ms-text-faint', className)}
      {...props}
    />
  )
}
