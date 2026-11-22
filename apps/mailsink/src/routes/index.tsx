import { Trans } from '@lingui/react/macro'
import { createFileRoute } from '@tanstack/react-router'
import { LocaleSwitcher } from '../i18n/locale-switcher'

export const Route = createFileRoute('/')({
  component: Home,
})

// Placeholder shell: the workspace picker replaces it in Phase 4. The tagline proves the
// i18n pipeline end to end (extraction, catalogs, SSR activation).
function Home() {
  return (
    <main>
      <LocaleSwitcher />
      <h1>Mailsink</h1>
      <p>
        <Trans>Catch every email your app sends, without delivering a single one.</Trans>
      </p>
    </main>
  )
}
