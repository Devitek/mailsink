import { Trans } from '@lingui/react/macro'
import { Mark, Wordmark } from '@mailsink/ui'
import { createFileRoute } from '@tanstack/react-router'
import { LocaleSwitcher } from '../i18n/locale-switcher'
import { ThemeToggle } from '../theme/theme-toggle'

export const Route = createFileRoute('/')({
  component: Home,
})

// Minimal branded shell: header of the prototype (mark, wordmark, controls) and the
// baseline. The application shell (#37: sign-in, workspace picker, « Language and
// session » menu) replaces the placeholder parts.
function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-header shrink-0 items-center gap-[13px] border-b border-ms-border bg-ms-panel px-4">
        <a href="/" className="flex items-center gap-2.5 text-md text-ms-text">
          <Mark size={20} />
          <Wordmark />
        </a>
        <div className="ml-auto flex items-center gap-2.5">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex max-w-[720px] flex-col items-center gap-6 text-center">
          <Mark size={64} />
          <h1 className="text-title leading-tight font-semibold tracking-[-0.02em] sm:text-display sm:leading-none sm:tracking-[-0.04em]">
            <Trans>
              Every email caught. <span className="block text-ms-accent-text">None delivered.</span>
            </Trans>
          </h1>
          <p className="max-w-[480px] text-md text-ms-text-muted">
            <Trans>Catch every email your app sends, without delivering a single one.</Trans>
          </p>
        </div>
      </main>
    </div>
  )
}
