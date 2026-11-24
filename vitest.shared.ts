import { defineProject } from 'vitest/config'

// Options shared by the projects running database suites (`describeDb`, D264). Directory
// projects do not inherit the root config, so each of their vitest.config.ts merges this.
// A full run puts one PGlite instance (WASM) or one Postgres database per suite on every
// worker at once: on a loaded host a migration or a runtime boot outlives the 5 s and
// 10 s defaults. The budgets stay well below what a hung test would need to be noticed.
export const dbProject = defineProject({
  test: {
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
