import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'

// shadcn/ui dialog (base-nova) shaped like the prototype modal « Nouveau workspace
// persistant »: centred, min(500px, 100vw - 24px), at most the viewport minus 40 px, panel
// background, strong border, header and footer separated by borders. Generic: also used
// for confirmations (delete a workspace, a connection).

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogPortal = DialogPrimitive.Portal

export function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-ms-overlay transition-opacity duration-fast ease-ms data-ending-style:opacity-0 data-starting-style:opacity-0',
        className,
      )}
      {...props}
    />
  )
}

export type DialogContentProps = DialogPrimitive.Popup.Props

export function DialogContent({ className, children, ...props }: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-40px)] w-[min(500px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-auto rounded-xl border border-ms-border-strong bg-ms-panel text-ms-text shadow-popover outline-none transition-[scale,opacity] duration-fast ease-ms data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-0.5 border-b border-ms-border px-6 py-[22px]', className)}
      {...props}
    />
  )
}

export function DialogBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-body"
      className={cn('flex flex-col gap-[18px] p-6', className)}
      {...props}
    />
  )
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex justify-end gap-2.5 border-t border-ms-border px-6 py-4', className)}
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-heading font-semibold', className)}
      {...props}
    />
  )
}

export function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-xs text-ms-text-faint', className)}
      {...props}
    />
  )
}
