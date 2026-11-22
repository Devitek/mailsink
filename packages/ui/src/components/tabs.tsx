import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'

// shadcn/ui tabs (base-nova) with the two prototype forms:
// - segmented (default): Desktop / Mobile, All / Resend… 24 px items in a bordered well;
// - line: inspector tabs, 36 px, 2 px accent text underline on the active tab.

export function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col data-[orientation=vertical]:flex-row', className)}
      {...props}
    />
  )
}

const tabsListVariants = cva('group/tabs-list relative flex w-fit items-center', {
  variants: {
    variant: {
      segmented: 'gap-0.5 rounded-md border border-ms-border bg-ms-bg p-0.5',
      line: 'gap-0',
    },
  },
  defaultVariants: { variant: 'segmented' },
})

export function TabsList({
  className,
  variant = 'segmented',
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 font-medium whitespace-nowrap text-ms-text-muted transition-colors duration-fast ease-ms outline-none hover:text-ms-text focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-50 data-active:text-ms-text',
        'group-data-[variant=segmented]/tabs-list:h-control-sm group-data-[variant=segmented]/tabs-list:flex-1 group-data-[variant=segmented]/tabs-list:rounded-xs group-data-[variant=segmented]/tabs-list:px-3.5 group-data-[variant=segmented]/tabs-list:text-xs group-data-[variant=segmented]/tabs-list:font-normal group-data-[variant=segmented]/tabs-list:data-active:bg-ms-hover group-data-[variant=segmented]/tabs-list:data-active:shadow-[inset_0_0_0_1px_var(--ms-border-strong)]',
        'group-data-[variant=line]/tabs-list:h-9 group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-transparent group-data-[variant=line]/tabs-list:px-3.5 group-data-[variant=line]/tabs-list:data-active:border-ms-accent-text',
        className,
      )}
      {...props}
    />
  )
}

export function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn('flex-1 outline-none focus-visible:focus-ring', className)}
      {...props}
    />
  )
}
