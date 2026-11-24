import { fileURLToPath } from 'node:url'
import { defineProject } from 'vitest/config'

// The Vitest and Jest helper tests reuse the SDK harness, which runs against the app's real routes. `@mailsink/app/testing` is resolved by
// alias rather than declared as a devDependency: the app depends on the Playwright helpers,
// which depend on the SDK, so a package dependency would form a build cycle (#141).
export default defineProject({
  resolve: {
    alias: {
      '@mailsink/app/testing': fileURLToPath(
        new URL('../../apps/mailsink/src/testing.ts', import.meta.url),
      ),
    },
  },
})
