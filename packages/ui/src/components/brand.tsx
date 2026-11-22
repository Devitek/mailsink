import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'

/** Stroke of the « Le Bac » arrow on the 64 u grid (BRAND.md construction). */
export function markStrokeWidth(size: number): number {
  if (size <= 16) return 7
  if (size <= 24) return 6.5
  if (size <= 32) return 6
  return 5.5
}

// The mark drawn inline, as in the prototype header, so it follows the theme through the
// accent tokens. Decorative: the wordmark or a label next to it carries the name.
export function Mark({ size = 20, className }: Readonly<{ size?: number; className?: string }>) {
  const stroke = markStrokeWidth(size)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <rect width="64" height="64" rx="15" fill="var(--ms-accent)" />
      <path
        d="M32 13v21M23.5 26 32 34.5 40.5 26"
        fill="none"
        stroke="var(--ms-on-accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 37v6a6 6 0 0 0 6 6h22a6 6 0 0 0 6-6v-6"
        fill="none"
        stroke="var(--ms-on-accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </svg>
  )
}

/** `mailsink`, lower case, Geist 600, -0.04 em: the name is never translated. */
export function Wordmark({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span className={cn('font-sans font-semibold tracking-[-0.04em]', className)} {...props}>
      mailsink
    </span>
  )
}
