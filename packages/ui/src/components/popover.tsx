import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { cn } from '../lib/cn'

// Popover of the prototype workspace picker: same surface as the menu (panel, strong
// border, 10 px radius, popover shadow), for content that is not a list of menu items
// (links plus a switch).

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverClose = PopoverPrimitive.Close
export const PopoverTitle = PopoverPrimitive.Title

export type PopoverContentProps = PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, 'align' | 'side' | 'sideOffset'>

export function PopoverContent({
  className,
  align = 'start',
  side = 'bottom',
  sideOffset = 8,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        className="z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'max-w-[calc(100vw-24px)] overflow-hidden rounded-lg border border-ms-border-strong bg-ms-panel text-ms-text shadow-popover outline-none transition-[transform,opacity] duration-fast ease-ms data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0',
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}
