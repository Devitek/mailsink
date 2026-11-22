import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

// Placeholder shell: the workspace picker replaces it in Phase 4. Only the product name is
// rendered, so there is no user-facing string to translate before Lingui lands (#10).
function Home() {
  return (
    <main>
      <h1>Mailsink</h1>
    </main>
  )
}
