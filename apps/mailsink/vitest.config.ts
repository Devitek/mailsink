import { defineProject, mergeConfig } from 'vitest/config'
import { dbProject } from '../../vitest.shared.ts'

// Unit tests run without the Start/Nitro plugins of vite.config.ts.
export default mergeConfig(
  dbProject,
  defineProject({
    test: {
      name: 'app',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  }),
)
