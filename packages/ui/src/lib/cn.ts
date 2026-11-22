import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge must know the custom scales of theme.css, otherwise it treats `text-sm`
// (font size) and `text-ms-text` (colour) as conflicting, or keeps two control heights.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['badge', 'label', 'xs', 'sm', 'body', 'md', 'heading', 'title', 'display'],
      radius: ['xs', 'sm', 'md', 'lg', 'xl'],
      shadow: ['thumb', 'sheet', 'popover'],
    },
    classGroups: {
      h: [{ h: ['control-sm', 'control-md', 'control-lg', 'control-xl', 'header'] }],
      size: [{ size: ['control-sm', 'control-md', 'control-lg'] }],
      duration: [{ duration: ['fast', 'base'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
