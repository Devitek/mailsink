import { defineConfig } from '@playwright/test'
import { baseConfig, webServer } from './tests/e2e/web-server'

// End-to-end scenarios against the production build (`pnpm build` first), on a throwaway
// PGlite directory. The fallback scenario has its own build: tests/e2e/fallback.
export default defineConfig({
  ...baseConfig('app'),
  testDir: './tests/e2e',
  testIgnore: 'fallback/**',
  webServer: webServer({ entry: '.output/server/index.mjs' }),
})
