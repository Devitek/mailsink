// Public entry point of @mailsink/ui: shadcn/ui components on Base UI, styled with the
// --ms-* tokens. Styles: import `@mailsink/ui/styles.css` after `@import "tailwindcss"`.
// Components carry no user-facing text of their own: labels come translated from the app.
export { Mark, markStrokeWidth, Wordmark } from './components/brand'
export { Button, type ButtonProps, buttonVariants } from './components/button'
export { Card } from './components/card'
export { Field, FieldControl, FieldDescription, FieldError, FieldLabel } from './components/field'
export { Input, type InputProps, inputVariants } from './components/input'
export {
  Menu,
  MenuContent,
  type MenuContentProps,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from './components/menu'
export {
  Popover,
  PopoverClose,
  PopoverContent,
  type PopoverContentProps,
  PopoverTitle,
  PopoverTrigger,
} from './components/popover'
export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  type SheetContentProps,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from './components/sheet'
export { StatusBadge, type StatusBadgeProps, statusColorVar } from './components/status-badge'
export { Switch } from './components/switch'
export { Tabs, TabsContent, TabsList, TabsTrigger } from './components/tabs'
export { cn } from './lib/cn'
