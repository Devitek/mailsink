import { defineProject } from 'vitest/config'

// Unit tests run without the Start/Nitro plugins of vite.config.ts.
export default defineProject({
  test: {
    name: 'app',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
