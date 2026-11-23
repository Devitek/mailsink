import { defineConfig } from '@playwright/test'
import { baseConfig, webServer } from './tests/e2e/web-server'

// End-to-end scenarios against the production build (`pnpm build` first), on a throwaway
// PGlite directory. The fallback scenario has its own build: tests/e2e/fallback.
// The sign-in limiter scenario pauses the only client address of the run (127.0.0.1), so it
// runs alone, after every other scenario.
const LIMITER = '**/ui/login-limit.spec.ts'

export default defineConfig({
  ...baseConfig('app'),
  testDir: './tests/e2e',
  testIgnore: 'fallback/**',
  webServer: webServer({ entry: '.output/server/index.mjs' }),
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' }, testIgnore: ['fallback/**', LIMITER] },
    {
      name: 'login-limit',
      use: { browserName: 'chromium' },
      testMatch: LIMITER,
      dependencies: ['chromium'],
    },
  ],
})
