import { useLingui } from '@lingui/react/macro'
import { Button, cn } from '@mailsink/ui'
import { useTheme } from './theme-context'

// Header light / dark toggle of the prototype: 30 px square, half-filled disc. The visible
// glyph carries no text, so the name comes from aria-label (brief 2 copy).
export function ThemeToggle({ className }: Readonly<{ className?: string }>) {
  const { t } = useLingui()
  const { toggleTheme } = useTheme()
  const label = t`Toggle light / dark`
  return (
    <Button
      variant="secondary"
      size="icon"
      className={cn('border-ms-border', className)}
      aria-label={label}
      title={label}
      onClick={toggleTheme}
    >
      <span
        aria-hidden
        className="size-3 rounded-full border-[1.5px] border-ms-text bg-[linear-gradient(90deg,var(--ms-text)_50%,transparent_50%)]"
      />
    </Button>
  )
}
