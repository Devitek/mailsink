import { Toast as ToastPrimitive } from '@base-ui/react/toast'
import { type ReactNode, useCallback } from 'react'
import { cn } from '../lib/cn'

// Toast of the prototype (« Copié dans le presse-papiers »): one short line in mono type,
// ink on the page background, bottom center, gone after 2.6 s. Base UI announces it in a
// polite live region. Mount <ToastProvider> once near the root; call `useToast()` anywhere
// below it. The text comes translated from the app (no strings here).

const TOAST_TIMEOUT_MS = 2600

export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ToastPrimitive.Provider timeout={TOAST_TIMEOUT_MS} limit={1}>
      {children}
      <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport className="fixed bottom-[18px] left-1/2 z-[70] w-max max-w-[calc(100vw-24px)] -translate-x-1/2 outline-none">
          <ToastList />
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  )
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()
  return toasts.map((toast) => (
    <ToastPrimitive.Root
      key={toast.id}
      toast={toast}
      data-slot="toast"
      className={cn(
        'rounded-lg bg-ms-text px-[19px] py-3.5 font-mono text-sm font-medium text-ms-bg shadow-popover',
        'transition-[opacity,translate] duration-fast ease-ms',
        'data-ending-style:translate-y-2 data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:opacity-0',
      )}
    >
      <ToastPrimitive.Content>
        <ToastPrimitive.Title />
      </ToastPrimitive.Content>
    </ToastPrimitive.Root>
  ))
}

/** Shows a toast; `priority: 'high'` for failures (announced assertively). */
export function useToast(): (message: ReactNode, options?: { priority?: 'low' | 'high' }) => void {
  const manager = ToastPrimitive.useToastManager()
  return useCallback(
    (message, options) => {
      manager.add({ title: message, priority: options?.priority ?? 'low' })
    },
    [manager],
  )
}
