import { cn } from '@mailsink/ui'
import type { ComponentProps, ReactNode } from 'react'

// Right-hand panel of the prototype connections screen: 10 px radius on the panel surface,
// a header with title, subtitle and actions, then the body.

export function Panel({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'min-w-0 flex-[1_1_400px] overflow-hidden rounded-lg border border-ms-border bg-ms-panel',
        className,
      )}
      {...props}
    />
  )
}

export function PanelHeader({
  title,
  subtitle,
  children,
}: Readonly<{ title: ReactNode; subtitle?: ReactNode; children?: ReactNode }>) {
  return (
    <div className="flex flex-wrap items-center gap-[13px] border-b border-ms-border px-[22px] py-[19px]">
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-semibold">{title}</h2>
        {subtitle && <div className="text-xs text-ms-text-faint">{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}
