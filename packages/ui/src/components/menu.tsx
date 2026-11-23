import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'

// Menu of the prototype header (H2b): panel popup, strong border, 10 px radius, popover
// shadow, 140 ms pop. Items 38 px high with a 6 px radius, hover fill, accent check.

export const Menu = MenuPrimitive.Root
export const MenuTrigger = MenuPrimitive.Trigger
export const MenuRadioGroup = MenuPrimitive.RadioGroup

export type MenuContentProps = MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, 'align' | 'side' | 'sideOffset'>

export function MenuContent({
  className,
  align = 'end',
  side = 'bottom',
  sideOffset = 6,
  ...props
}: MenuContentProps) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner align={align} side={side} sideOffset={sideOffset} className="z-50">
        <MenuPrimitive.Popup
          data-slot="menu-content"
          className={cn(
            'min-w-[280px] max-w-[calc(100vw-24px)] overflow-hidden rounded-lg border border-ms-border-strong bg-ms-panel text-ms-text shadow-popover outline-none transition-[transform,opacity] duration-fast ease-ms data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0',
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

export function MenuGroup({ className, ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group className={cn('p-1.5', className)} {...props} />
}

/** Section title: the uppercase label style of BRAND.md. */
export function MenuGroupLabel({ className, ...props }: MenuPrimitive.GroupLabel.Props) {
  return (
    <MenuPrimitive.GroupLabel
      className={cn(
        'px-2 pt-1.5 pb-2 text-label font-medium tracking-[0.06em] text-ms-text-faint uppercase',
        className,
      )}
      {...props}
    />
  )
}

const itemClass =
  'flex min-h-[38px] cursor-pointer items-center gap-3 rounded-sm px-2 text-body text-ms-text outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-ms-hover'

export function MenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return <MenuPrimitive.Item className={cn(itemClass, className)} {...props} />
}

/** Radio item with the accent check of H2b in a 14 px column. */
export function MenuRadioItem({ className, children, ...props }: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem
      className={cn(itemClass, 'data-checked:bg-ms-hover', className)}
      {...props}
    >
      <span className="flex w-3.5 justify-center text-ms-accent-text">
        <MenuPrimitive.RadioItemIndicator>
          <svg
            viewBox="0 0 16 16"
            aria-hidden
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}

export function MenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn('h-px bg-ms-border', className)} {...props} />
}
