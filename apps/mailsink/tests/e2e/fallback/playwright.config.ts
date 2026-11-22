import { defineConfig } from '@playwright/test'
import { baseConfig, webServer } from '../web-server'

// Builds the app with a test-only `de` locale (./vite.config.ts), then serves that build.
// Run after the main config: both use the same ports.
export default defineConfig({
  ...baseConfig('fallback'),
  testDir: '.',
  webServer: webServer({
    build: 'vite build --config tests/e2e/fallback/vite.config.ts',
    entry: 'tests/e2e/fallback/.output/build/server/index.mjs',
  }),
})
