import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    passWithNoTests: true,
    // GitHub runners have 4 vCPU shared with the Postgres service: two workers keep the
    // database suites within their timeouts (D264). Locally, the default (cores - 1).
    maxWorkers: process.env.CI ? 2 : undefined,
  },
})
