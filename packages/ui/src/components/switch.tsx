import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import { cn } from '../lib/cn'

// Toggle of IMPLEMENTATION 6 at the prototype measures: 32 x 18 track, 14 px thumb with a
// 2 px inset. On: accent fill with a white thumb and a shadow, visible on the yellow.
export function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'relative inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full border-0 p-0.5 transition-colors duration-fast ease-ms outline-none focus-visible:focus-ring data-checked:bg-ms-accent data-unchecked:bg-ms-border-strong data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-3.5 rounded-full bg-ms-switch-thumb shadow-thumb transition-transform duration-fast ease-ms data-checked:translate-x-3.5"
      />
    </SwitchPrimitive.Root>
  )
}
