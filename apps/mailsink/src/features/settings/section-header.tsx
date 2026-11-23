import { cn } from '@mailsink/ui'
import type { ComponentProps, ReactNode } from 'react'

// Head of a settings section (prototype « Endpoints webhook »): bold title, faint one-line
// description, actions on the right.
export function SectionHeader({
  title,
  description,
  children,
}: Readonly<{ title: ReactNode; description?: ReactNode; children?: ReactNode }>) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="font-semibold">{title}</h3>
        {description && <p className="text-xs text-ms-text-faint">{description}</p>}
      </div>
      {children}
    </div>
  )
}

/** Panel surface of the settings cards: 10 px radius, 19 to 22 px padding. */
export function SettingsCard({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('rounded-lg border border-ms-border bg-ms-panel p-[22px]', className)}
      {...props}
    />
  )
}
